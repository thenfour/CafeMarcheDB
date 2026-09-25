import { wikiTransaction } from "../server/wikiTransaction";
// updateWikiPage
import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import { Prisma, PrismaClient } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { GetDateSecondsFromNow } from "shared/time";
import * as db3 from "src/core/db3/db3";
import { authorizeAndProjectViewDto } from "src/core/db3/server/db3QueryCore";
import * as mutationCore from "src/core/db3/server/db3mutationCore";
import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { calculateDiff, GetWikiPageUpdatability, GetWikiPageUpdatabilityResult, gWikiPageLockDurationSeconds, SpecialWikiNamespace, TUpdateWikiPageArgs, UpdateWikiPageResultOutcome, WikiPageApiPayload, WikiPageApiRevisionPayload, WikiPageApiRevisionPayloadArgs, wikiParseCanonicalWikiPath, ZTUpdateWikiPageArgs } from "src/core/wiki/shared/wikiUtils";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { wikiPageApiSelection } from "src/core/db3/shared/entities/wiki/wikiViews";

const ConsolidatedUpdate = async (args: TUpdateWikiPageArgs, existingRevisionToConsolidate: Prisma.WikiPageRevisionGetPayload<{}>, currentPage: WikiPageApiPayload, currentUserId: number, dbt: TransactionalPrismaClient): Promise<WikiPageApiRevisionPayload> => {

    // we must also calculate stats from the previous revision to this one.
    const prevRevision = await dbt.wikiPageRevision.findFirst({
        where: {
            wikiPageId: currentPage.id,
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
const UpdateOrConsolidateRevision = async (args: TUpdateWikiPageArgs, currentPage: WikiPageApiPayload, currentUserId: number, dbt): Promise<WikiPageApiRevisionPayload> => {
    // check if we should consolidate the revision. don't create a new revision if
    // - the current revision was made with the same lock ID
    const revisionForConsolidation = await (dbt as PrismaClient).wikiPageRevision.findMany({
        where: {
            id: currentPage.currentRevision?.id ?? -1,
            wikiPageId: currentPage.id,
            createdByUserId: currentUserId,
            consolidationKey: args.lockId,
            // tempting to do this but it's just kinda not useful and prevents you from ever making deliberate revisions.
            // OR: [
            //     { createdAt: { gte: GetDateSecondsFromNow(-5 * 60) } }, // 5 minutes
            // ]
        },
        orderBy: { createdAt: "desc" },
        take: 1,
    });

    if (revisionForConsolidation.length > 0) {
        const newRevision = await ConsolidatedUpdate(args, revisionForConsolidation[0]!, currentPage, currentUserId, dbt);
        return newRevision;
    }

    const stats = calculateDiff(currentPage.currentRevision?.content || "", args.content);

    const newRevision = await dbt.wikiPageRevision.create({
        data: {
            name: args.title,
            content: args.content,
            createdByUserId: currentUserId,
            wikiPageId: currentPage.id,
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
    currentUserId: number,
    publicData: db3.DB3Authorization,
    dbt: TransactionalPrismaClient,
): Promise<GetWikiPageUpdatabilityResult> => {

    const updatability = GetWikiPageUpdatability({
        currentPage,
        currentUserId,
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

    const newRevision = await UpdateOrConsolidateRevision(args, currentPage, currentUserId, dbt);

    const updatedPage = await dbt.wikiPage.update({
        where: { id: currentPage.id },
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
        publicData,
        "mutation:WikiPage.update",
    );
    if (!projectedUpdatedPage) throw new Error("Updated wiki page was not authorized for reading.");

    const wikiPath = wikiParseCanonicalWikiPath(args.canonicalWikiPath);
    if (wikiPath.namespace?.toLowerCase() === SpecialWikiNamespace.EventDescription.toLowerCase()) {
        // for safety, now make sure the event is linked to this page. yes it's redundant, but safe.
        assert(currentPage.id === updatedPage.id, "Wiki page ID mismatch after update.");
        if (db3.xEvent.isIdentity(wikiPath.slugWithoutNamespace)) {
            const eventId = db3.xEvent.parseIdentity(wikiPath.slugWithoutNamespace);
            await dbt.event.update({
                where: { publicId: eventId },
                data: {
                    descriptionWikiPageId: currentPage.id,
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
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTUpdateWikiPageArgs),
    async (args: TUpdateWikiPageArgs, ctx: AuthenticatedCtx): Promise<GetWikiPageUpdatabilityResult> => {

        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
        const publicData = await db3.createDb3RequestAuthorization(ctx);
        const changeContext = CreateChangeContext("updateWikiPage");

        return await wikiTransaction(async (dbt) => {
            const wikiPageRow = await dbt.wikiPage.findFirst({
                where: await GetAuthorizedTableReadWhere({
                    table: xWikiPage,
                    currentUser,
                    where: { slug: args.canonicalWikiPath },
                }),
                ...wikiPageApiSelection,
            });
            const wikiPage = wikiPageRow
                ? authorizeAndProjectViewDto(
                    db3.wikiPageApiView,
                    wikiPageRow,
                    publicData,
                    "mutation:WikiPage.update.load",
                )
                : null;
            let result: GetWikiPageUpdatabilityResult;
            if (wikiPage) {
                result = await UpdateExistingWikiPage(args, wikiPage, currentUser.id, publicData, dbt);
            } else {
                result = { ...GetWikiPageUpdatability({ currentPage: null, currentUserId: currentUser.id,
                    userClientLockId: args.lockId, baseRevisionId: args.baseRevisionId,
                    baseContentVersion: args.baseContentVersion }),
                    outcome: UpdateWikiPageResultOutcome.lockConflict, isLockConflict: true };
            }
            if (result.outcome === UpdateWikiPageResultOutcome.success) {
                await RegisterChange({
                    db: dbt,
                    action: ChangeAction.insert,
                    ctx,
                    changeContext,
                    pkid: result.currentPage!.currentRevision!.id,
                    table: "wikiPageRevision",
                    newValues: result.currentPage!.currentRevision!,
                });
            }
            return result;
        });
    }
);

