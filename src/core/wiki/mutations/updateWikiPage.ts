import { wikiTransaction } from "../server/wikiTransaction";
// updateWikiPage
import { CMAuthCtxWithUser, cmauthorize } from "@/src/auth/server/cmResolver";
import { CMServerAuthorizationWithUser } from "@/src/auth/server/serverAuthorization";
import { resolver } from "@blitzjs/rpc";
import { assert } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GetDateSecondsFromNow } from "shared/time";
import * as db3 from "src/core/db3/db3";
import { authorizeAndProjectViewDto } from "src/core/db3/server/db3QueryCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { wikiPageApiSelection } from "src/core/db3/shared/entities/wiki/wikiViews";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { calculateDiff, GetWikiPageUpdatability, GetWikiPageUpdatabilityResult, gWikiPageLockDurationSeconds, SpecialWikiNamespace, TUpdateWikiPageArgs, UpdateWikiPageResultOutcome, WikiPageApiPayload, WikiPageApiRevisionPayload, WikiPageApiRevisionPayloadArgs, wikiParseCanonicalWikiPath, ZTUpdateWikiPageArgs } from "src/core/wiki/shared/wikiUtils";
import { generatePublicId } from "src/server/publicId";

const ConsolidatedUpdate = async (args: TUpdateWikiPageArgs, existingRevisionToConsolidate: Prisma.WikiPageRevisionGetPayload<{}>, currentPageNaturalId: number, dbt: TransactionalPrismaClient): Promise<WikiPageApiRevisionPayload> => {

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
const UpdateOrConsolidateRevision = async (args: TUpdateWikiPageArgs, currentPage: WikiPageApiPayload, currentPageNaturalId: number, currentUserId: number, dbt: TransactionalPrismaClient): Promise<WikiPageApiRevisionPayload> => {
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
        const newRevision = await ConsolidatedUpdate(args, revisionForConsolidation[0]!, currentPageNaturalId, dbt);
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


const UpdateExistingWikiPage = async (
    args: TUpdateWikiPageArgs,
    currentPage: WikiPageApiPayload,
    currentPageNaturalId: number,
    auth: CMServerAuthorizationWithUser,
    dbt: TransactionalPrismaClient,
): Promise<GetWikiPageUpdatabilityResult> => {

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

    const newRevision = await UpdateOrConsolidateRevision(args, currentPage, currentPageNaturalId, auth.userId, dbt);

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
    const projectedUpdatedPage = authorizeAndProjectViewDto(
        db3.wikiPageApiView,
        updatedPage,
        auth,
        "mutation:WikiPage.update",
    );
    if (!projectedUpdatedPage) throw new Error("Updated wiki page was not authorized for reading.");

    const wikiPath = wikiParseCanonicalWikiPath(args.canonicalWikiPath);
    if (wikiPath.namespace?.toLowerCase() === SpecialWikiNamespace.EventDescription.toLowerCase()) {
        // for safety, now make sure the event is linked to this page. yes it's redundant, but safe.
        assert(currentPageNaturalId === updatedPage.id, "Wiki page ID mismatch after update.");
        if (db3.xEvent.isIdentity(wikiPath.slugWithoutNamespace)) {
            const eventId = db3.xEvent.parseIdentity(wikiPath.slugWithoutNamespace);
            await dbt.event.update({
                where: { publicId: eventId },
                data: {
                    descriptionWikiPageId: currentPageNaturalId,
                },
            });
        }
    }

    return {
        ...updatability,
        currentPage: projectedUpdatedPage,
    };
};

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    cmauthorize(Permission.edit_wiki_pages),
    resolver.zod(ZTUpdateWikiPageArgs),
    async (args: TUpdateWikiPageArgs, ctx: CMAuthCtxWithUser): Promise<GetWikiPageUpdatabilityResult> => {

        const authWithUser = ctx.auth.requireUser();

        return await wikiTransaction(async (dbt) => {
            const wikiPageRow = await dbt.wikiPage.findFirst({
                where: await GetAuthorizedTableReadWhere({
                    table: xWikiPage,
                    auth: ctx.auth,
                    where: { slug: args.canonicalWikiPath },
                }),
                ...wikiPageApiSelection,
            });
            const wikiPage = wikiPageRow
                ? authorizeAndProjectViewDto(
                    db3.wikiPageApiView,
                    wikiPageRow,
                    ctx.auth,
                    "mutation:WikiPage.update.load",
                )
                : null;
            let result: GetWikiPageUpdatabilityResult;
            if (wikiPage && wikiPageRow) {
                result = await UpdateExistingWikiPage(
                    args,
                    wikiPage,
                    wikiPageRow.id,
                    //currentUser.id,
                    //db3.xUser.parseIdentity(currentUser.publicId),
                    authWithUser,
                    dbt
                );
            } else {
                result = {
                    ...GetWikiPageUpdatability({
                        currentPage: null,
                        currentUserPublicId: authWithUser.userPublicId,
                        userClientLockId: args.lockId,
                        baseRevisionId: args.baseRevisionId,
                        baseContentVersion: args.baseContentVersion
                    }),
                    outcome: UpdateWikiPageResultOutcome.lockConflict, isLockConflict: true
                };
            }
            if (result.outcome === UpdateWikiPageResultOutcome.success) {
                const revision = await dbt.wikiPageRevision.findUniqueOrThrow({
                    where: { publicId: result.currentPage!.currentRevision!.publicId },
                    select: { id: true },
                });
                // await RegisterChange({
                //     db: dbt,
                //     action: ChangeAction.insert,
                //     auth: ctx.auth,
                //     changeContext,
                //     pkid: revision.id,
                //     table: "wikiPageRevision",
                //     newValues: result.currentPage!.currentRevision!,
                // });
            }
            return result;
        });
    }
);

