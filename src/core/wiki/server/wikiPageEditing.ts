import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { AuthorizationError } from "blitz";
import { Prisma } from "db";
import { GetDateSecondsFromNow } from "shared/time";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorizationWithUser } from "src/auth/server/serverAuthorization";
import { GetDefaultVisibilityPermission } from "src/core/db3/server/db3Helpers";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { wikiPageApiSelection } from "src/core/db3/shared/entities/wiki/wikiViews";
import { generatePublicId } from "src/server/publicId";
import { calculateDiff, GetWikiPageUpdatability, type GetWikiPageUpdatabilityResult, gWikiPageLockDurationSeconds, type TAcquireLockOnWikiPageArgs, type TUpdateWikiPageArgs, UpdateWikiPageResultOutcome, type WikiPageApiPayload, type WikiPageApiRevisionPayload, WikiPageApiRevisionPayloadArgs, wikiParseCanonicalWikiPath } from "../shared/wikiUtils";
import { requireWikiAccess } from "./wikiAuthorization";
import { findReadableWikiPage, findWikiDescriptionEvent, projectWikiPage } from "./wikiPageAccess";

export async function acquireWikiLock(context: DB3ReadContext, args: TAcquireLockOnWikiPageArgs): Promise<GetWikiPageUpdatabilityResult> {
    const auth = requireWikiAccess(context, BandPermission.edit_wiki_pages);
    const currentUser = auth.user;
    const dbt = context.database;
    await findWikiDescriptionEvent(context, args.canonicalWikiPath);
    // get latest page & check if we can acquire lock.
    const currentPageRow = await findReadableWikiPage(context, args.canonicalWikiPath);
    let currentPage = currentPageRow ? projectWikiPage(context, currentPageRow) : null;

    const updatability = GetWikiPageUpdatability({
        currentPage: currentPage,
        currentUserPublicId: auth.userPublicId,
        baseRevisionId: args.baseRevisionId,
        baseContentVersion: args.baseContentVersion,
        userClientLockId: args.lockId,
    });

    const isOwnTakeover = currentPage?.lockedByUser?.publicId === currentUser.publicId &&
        !!args.takeOverLockId && currentPage.lockId === args.takeOverLockId;
    if ((updatability.isLockConflict && !isOwnTakeover) || updatability.isRevisionConflict) {
        return updatability;
    }

    // we are clear: acquire lock.

    // page must be created in order to store lock info.
    let currentPageNaturalId = currentPageRow?.id;
    if (!currentPage) {
        // A hidden page still owns its slug; it must never enter creation.
        const existingPage = currentPageRow ?? await dbt.wikiPage.findUnique({
            where: { bandId_slug: { bandId: auth.requireBand().id, slug: args.canonicalWikiPath } },
            select: { id: true },
        });
        if (existingPage) {
            throw new AuthorizationError();
        }

        const wikiPath = wikiParseCanonicalWikiPath(args.canonicalWikiPath);
        const visPerm = await GetDefaultVisibilityPermission(dbt);
        if (!visPerm) {
            throw new Error("Default Members visibility permission is not configured.");
        }
        const createdPage = await dbt.wikiPage.create({
            data: {
                publicId: generatePublicId<"WikiPage">(),
                slug: args.canonicalWikiPath,
                namespace: wikiPath.namespace,
                visiblePermissionId: visPerm.id,
                createdByUserId: currentUser.id,
                bandId: auth.requireBand().id,
            },
            ...wikiPageApiSelection,
        });
        currentPage = projectWikiPage(context, createdPage);

        currentPageNaturalId = createdPage.id;
    }

    // now acquire the lock
    if (currentPageNaturalId === undefined) {
        throw new Error("Wiki page has no database identity.");
    }
    const updatedPage = await dbt.wikiPage.update({
        where: { id: currentPageNaturalId },
        data: {
            lockId: args.lockId,
            lockAcquiredAt: new Date(),
            lastEditPingAt: new Date(),
            lockExpiresAt: GetDateSecondsFromNow(gWikiPageLockDurationSeconds),
            lockedByUserId: currentUser.id,
        },
        ...wikiPageApiSelection,
    });
    currentPage = projectWikiPage(context, updatedPage);


    return {
        ...GetWikiPageUpdatability({
            currentPage, currentUserPublicId: auth.userPublicId,
            userClientLockId: args.lockId, baseRevisionId: args.baseRevisionId,
            baseContentVersion: args.baseContentVersion
        }),
    }
}

const consolidateRevision = async (args: TUpdateWikiPageArgs, existingRevisionToConsolidate: Prisma.WikiPageRevisionGetPayload<{}>, currentPageNaturalId: number, dbt: Prisma.TransactionClient): Promise<WikiPageApiRevisionPayload> => {

    // we must also calculate stats from the previous revision to this one.
    const prevRevision = await dbt.wikiPageRevision.findFirst({
        where: {
            wikiPageId: currentPageNaturalId,
            createdAt: { lt: existingRevisionToConsolidate.createdAt },
        },
        orderBy: { createdAt: "desc" },
    });

    const stats = calculateDiff(prevRevision?.content || "", args.content);

    const newRevision = await dbt.wikiPageRevision.update({
        where: { id: existingRevisionToConsolidate.id },
        data: {
            name: args.title,
            content: args.content,
            consolidationKey: args.lockId,
            createdAt: new Date(),

            lineCount: stats.newLines,
            prevLineCount: stats.oldLines,
            linesAdded: stats.linesAdded,
            linesRemoved: stats.linesRemoved,

            prevSizeChars: stats.oldSize,
            sizeChars: stats.newSize,

            charsAdded: stats.charsAdded,
            charsRemoved: stats.charsRemoved,
        },
        ...WikiPageApiRevisionPayloadArgs,
    });
    return newRevision;
};

// internal; makes assumptions.
const saveRevision = async (args: TUpdateWikiPageArgs, currentPage: WikiPageApiPayload, currentPageNaturalId: number, currentUserId: number, dbt: Prisma.TransactionClient): Promise<WikiPageApiRevisionPayload> => {
    // check if we should consolidate the revision. don't create a new revision if
    // - the current revision was made with the same lock ID
    const revisionForConsolidation = currentPage.currentRevision ? await dbt.wikiPageRevision.findMany({
        where: {
            publicId: currentPage.currentRevision.publicId,
            wikiPageId: currentPageNaturalId,
            createdByUserId: currentUserId,
            consolidationKey: args.lockId,
            // tempting to do this but it's just kinda not useful and prevents you from ever making deliberate revisions.
            // OR: [
            //     { createdAt: { gte: GetDateSecondsFromNow(-5 * 60) } }, // 5 minutes
            // ]
        },
        orderBy: { createdAt: "desc" },
        take: 1,
    }) : [];

    if (revisionForConsolidation.length > 0) {
        const newRevision = await consolidateRevision(args, revisionForConsolidation[0]!, currentPageNaturalId, dbt);
        return newRevision;
    }

    const stats = calculateDiff(currentPage.currentRevision?.content || "", args.content);

    const newRevision = await dbt.wikiPageRevision.create({
        data: {
            publicId: generatePublicId<"WikiPageRevision">(),
            name: args.title,
            content: args.content,
            createdByUserId: currentUserId,
            wikiPageId: currentPageNaturalId,
            consolidationKey: args.lockId,

            lineCount: stats.newLines,
            prevLineCount: stats.oldLines,
            linesAdded: stats.linesAdded,
            linesRemoved: stats.linesRemoved,

            prevSizeChars: stats.oldSize,
            sizeChars: stats.newSize,

            charsAdded: stats.charsAdded,
            charsRemoved: stats.charsRemoved,
        },
        ...WikiPageApiRevisionPayloadArgs,
    });
    return newRevision;
};


const saveLockedPage = async (
    args: TUpdateWikiPageArgs,
    currentPage: WikiPageApiPayload,
    currentPageNaturalId: number,
    auth: CMServerAuthorizationWithUser,
    context: DB3ReadContext,
): Promise<GetWikiPageUpdatabilityResult> => {

    const dbt = context.database;
    const updatability = GetWikiPageUpdatability({
        currentPage,
        currentUserPublicId: auth.userPublicId,
        userClientLockId: args.lockId,
        baseRevisionId: args.baseRevisionId,
        baseContentVersion: args.baseContentVersion,
    });

    if (updatability.outcome !== UpdateWikiPageResultOutcome.success) {
        return updatability;
    }

    if (!updatability.isLockedInThisContext) {
        return { ...updatability, outcome: UpdateWikiPageResultOutcome.lockConflict, isLockConflict: true };
    }

    const newRevision = await saveRevision(args, currentPage, currentPageNaturalId, auth.userId, dbt);

    const updatedPage = await dbt.wikiPage.update({
        where: { id: currentPageNaturalId },
        data: {
            currentRevisionId: newRevision.id,
            contentVersion: { increment: 1 },
            lockExpiresAt: GetDateSecondsFromNow(gWikiPageLockDurationSeconds),
            lastEditPingAt: new Date(),
        },
        ...wikiPageApiSelection,
    });
    const projectedUpdatedPage = projectWikiPage(context, updatedPage);
    const event = await findWikiDescriptionEvent(context, args.canonicalWikiPath);
    if (event) {
        // The parent was authorized in this snapshot; retain band ownership in the link write.
        await dbt.event.update({
            where: { publicId: event.publicId, bandId: auth.requireBand().id },
            data: { descriptionWikiPageId: currentPageNaturalId },
        });
    }

    return {
        ...updatability,
        currentPage: projectedUpdatedPage,
    };
};

export async function saveWikiPage(context: DB3ReadContext, args: TUpdateWikiPageArgs): Promise<GetWikiPageUpdatabilityResult> {
    const auth = requireWikiAccess(context, BandPermission.edit_wiki_pages);
    await findWikiDescriptionEvent(context, args.canonicalWikiPath);
    const row = await findReadableWikiPage(context, args.canonicalWikiPath);
    if (!row) {
        return {
            ...GetWikiPageUpdatability({
                currentPage: null, currentUserPublicId: auth.userPublicId,
                userClientLockId: args.lockId, baseRevisionId: args.baseRevisionId,
                baseContentVersion: args.baseContentVersion,
            }),
            outcome: UpdateWikiPageResultOutcome.lockConflict,
            isLockConflict: true,
        };
    }
    const result = await saveLockedPage(args, projectWikiPage(context, row), row.id, auth, context);
    if (result.outcome === UpdateWikiPageResultOutcome.success && result.currentPage?.currentRevision) {
        const revision = await context.database.wikiPageRevision.findUniqueOrThrow({
            where: { publicId: result.currentPage.currentRevision.publicId }, select: { id: true },
        });
        await RegisterChange({
            db: context.database, action: ChangeAction.insert, auth,
            changeContext: CreateChangeContext("updateWikiPage"), pkid: revision.id,
            table: "wikiPageRevision", newValues: result.currentPage.currentRevision,
        });
    }
    return result;
}
