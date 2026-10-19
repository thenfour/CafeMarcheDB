import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { WikiPageRevisionPublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { deleteImpl } from "src/core/db3/server/db3mutationCore";
import { wikiPageRevisionDeleteTargetView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { AuthorizationError } from "blitz";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import { GetDateSecondsFromNow } from "shared/time";
import { resolvePublicForeignIds } from "src/core/db3/server/db3PublicIds";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { calculateDiff, gWikiPageLockDurationSeconds, type TAdminClearPageLockArgs, type TSetWikiPageVisibilityArgs, type TWikiReleaseYourLockArgs } from "../shared/wikiUtils";
import { requireWikiAccess } from "./wikiAuthorization";
import { findReadableWikiPage } from "./wikiPageAccess";

const clearedLock = () => ({
    lockId: null,
    lockAcquiredAt: null,
    lockExpiresAt: null,
    lockedByUserId: null,
    lastEditPingAt: null,
});

export async function renewWikiLock(context: DB3ReadContext, args: TWikiReleaseYourLockArgs) {
    const auth = requireWikiAccess(context, BandPermission.edit_wiki_pages);
    const page = await findReadableWikiPage(context, args.canonicalWikiPath);
    if (!page) {
        return false;
    }
    const result = await context.database.wikiPage.updateMany({
        where: {
            id: page.id, bandId: auth.requireBand().id, lockId: args.lockId,
            lockedByUserId: auth.userId, lockExpiresAt: { gt: new Date() },
        },
        data: { lockExpiresAt: GetDateSecondsFromNow(gWikiPageLockDurationSeconds), lastEditPingAt: new Date() },
    });
    return result.count === 1;
}

export async function releaseWikiLock(context: DB3ReadContext, args: TWikiReleaseYourLockArgs): Promise<void> {
    const auth = requireWikiAccess(context, BandPermission.edit_wiki_pages);
    const page = await findReadableWikiPage(context, args.canonicalWikiPath);
    if (!page) {
        return;
    }
    await context.database.wikiPage.updateMany({
        where: { id: page.id, bandId: auth.requireBand().id, lockId: args.lockId, lockedByUserId: auth.userId },
        data: clearedLock(),
    });
}

export async function clearWikiLock(context: DB3ReadContext, args: TAdminClearPageLockArgs): Promise<void> {
    const auth = requireWikiAccess(context, BandPermission.admin_wiki_pages);
    const page = await findReadableWikiPage(context, args.canonicalWikiPath);
    if (!page) {
        throw new AuthorizationError();
    }
    await context.database.wikiPage.update({
        where: { id: page.id, bandId: auth.requireBand().id }, data: clearedLock(),
    });
}

export async function setWikiVisibility(context: DB3ReadContext, args: TSetWikiPageVisibilityArgs): Promise<void> {
    const auth = requireWikiAccess(context, BandPermission.edit_wiki_pages);
    const page = await findReadableWikiPage(context, args.canonicalWikiPath);
    if (!page) {
        throw new AuthorizationError();
    }
    const values = await resolvePublicForeignIds(xWikiPage, { visiblePermissionId: args.visiblePermissionId }, auth, context.database);
    await context.database.wikiPage.update({
        where: { id: page.id, bandId: auth.requireBand().id },
        data: { visiblePermissionId: values.visiblePermissionId },
    });
    await RegisterChange({
        db: context.database, action: ChangeAction.update, auth,
        changeContext: CreateChangeContext("wikiPageSetVisibility"), table: "WikiPage", pkid: page.id,
        oldValues: { visiblePermissionId: page.visiblePermissionId },
        newValues: { visiblePermissionId: values.visiblePermissionId },
    });
}

export async function rebuildWikiRevisionStats(context: DB3ReadContext): Promise<void> {
    const auth = requireWikiAccess(context, BandPermission.admin_wiki_pages);
    // Maintenance includes hidden pages in the selected band and returns no content.
    const pages = await context.database.wikiPage.findMany({
        where: { bandId: auth.requireBand().id },
        select: { revisions: { orderBy: [{ createdAt: "desc" }, { publicId: "desc" }] } },
    });
    for (const page of pages) {
        for (let index = 0; index < page.revisions.length; index++) {
            const revision = page.revisions[index]!;
            const stats = calculateDiff(page.revisions[index + 1]?.content ?? "", revision.content);
            await context.database.wikiPageRevision.update({
                where: { id: revision.id },
                data: {
                    lineCount: stats.newLines, prevLineCount: stats.oldLines,
                    linesAdded: stats.linesAdded, linesRemoved: stats.linesRemoved,
                    prevSizeChars: stats.oldSize, sizeChars: stats.newSize,
                    charsAdded: stats.charsAdded, charsRemoved: stats.charsRemoved,
                },
            });
        }
    }
    await RegisterChange({
        db: context.database, action: ChangeAction.update, auth,
        changeContext: CreateChangeContext("rebuildWikiPageRevisionStats"), table: "WikiPageRevision", pkid: -1,
    });
}

export async function deleteWikiPageRevision(context: DB3ReadContext, revisionId: WikiPageRevisionPublicId): Promise<void> {
    const authorization = requireWikiAccess(context, BandPermission.admin_wiki_pages);
    const tx = context.database;
    const target = await queryView({
        view: wikiPageRevisionDeleteTargetView,
        filter: { publicIds: [revisionId] },
        orderBy: undefined,
        take: 1,
        cmdbQueryContext: "wiki/revision-delete",
    }, authorization, context);
    if (!target.items.length) {
        throw new Error("Wiki page revision was not found.");
    }

    // The scoped view authorized this public ID in the same transaction.
    const revision = await tx.wikiPageRevision.findUnique({
        where: { publicId: revisionId },
        select: { id: true, wikiPage: { select: { currentRevisionId: true } } },
    });
    if (!revision?.wikiPage) {
        throw new Error("Wiki page revision was not found.");
    }
    if (revision.wikiPage.currentRevisionId === revision.id) {
        throw new Error("The current wiki page revision cannot be deleted.");
    }

    await deleteImpl(db3.xWikiPageRevision, revision.id, authorization, "hard", tx);
}
