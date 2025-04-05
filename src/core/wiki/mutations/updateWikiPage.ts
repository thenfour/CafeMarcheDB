// updateWikiPage
import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { GetDateSecondsFromNow } from "shared/time";
import { IsEntirelyIntegral } from "shared/utils";
import * as mutationCore from "src/core/db3/server/db3mutationCore";
import { getDefaultVisibilityPermission } from "src/core/db3/server/serverPermissionUtils";
import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { calculateDiff, GetWikiPageUpdatability, GetWikiPageUpdatabilityResult, gWikiPageLockDurationSeconds, SpecialWikiNamespace, TUpdateWikiPageArgs, UpdateWikiPageResultOutcome, WikiPageApiPayload, WikiPageApiPayloadArgs, WikiPageApiRevisionPayload, WikiPageApiRevisionPayloadArgs, wikiParseCanonicalWikiPath, ZTUpdateWikiPageArgs } from "src/core/wiki/shared/wikiUtils";

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
const UpdateOrConsolidateRevision = async (args: TUpdateWikiPageArgs, currentPage: WikiPageApiPayload, currentUserId: number, dbt: TransactionalPrismaClient): Promise<WikiPageApiRevisionPayload> => {
    // check if we should consolidate the revision. don't create a new revision if
    // - the current revision was made with the same lock ID
    // - the current revision was made by the same user within the last 5 minutes
    const revisionForConsolidation = await dbt.wikiPageRevision.findMany({
        where: {
            wikiPageId: currentPage.id,
            createdByUserId: currentUserId,
            OR: [
                { consolidationKey: args.lockId },
                { createdAt: { gte: GetDateSecondsFromNow(-5 * 60) } }, // 5 minutes
            ]
        },
        orderBy: { createdAt: "desc" },
        take: 1,
    });

    let newRevision: WikiPageApiRevisionPayload | undefined = undefined;

    if (revisionForConsolidation.length > 0) {
        newRevision = await ConsolidatedUpdate(args, revisionForConsolidation[0]!, currentPage, currentUserId, dbt);
    } else {
        const stats = calculateDiff(currentPage.currentRevision?.content || "", args.content);

        newRevision = await dbt.wikiPageRevision.create({
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
    }

    return newRevision;
};


const UpdateExistingWikiPage = async (args: TUpdateWikiPageArgs, currentPage: WikiPageApiPayload, currentUserId: number, dbt: TransactionalPrismaClient): Promise<GetWikiPageUpdatabilityResult> => {

    const updatability = GetWikiPageUpdatability({
        currentPage,
        currentUserId,
        userClientLockId: args.lockId,
        baseRevisionId: args.baseRevisionId,
    });

    if (updatability.outcome !== UpdateWikiPageResultOutcome.success) {
        return updatability;
    }

    const newRevision = await UpdateOrConsolidateRevision(args, currentPage, currentUserId, dbt);

    let updatedPage: WikiPageApiPayload;

    if (updatability.isLockedInThisContext) {
        // update the page in your locked context; this renews the lock.
        updatedPage = await dbt.wikiPage.update({
            where: { id: currentPage.id },
            data: {
                currentRevisionId: newRevision.id,
                lockExpiresAt: GetDateSecondsFromNow(gWikiPageLockDurationSeconds),
                lastEditPingAt: new Date(),
            },
            ...WikiPageApiPayloadArgs,
        });

    } else {
        // update the page without disturbing the existing lock.
        updatedPage = await dbt.wikiPage.update({
            where: { id: currentPage.id },
            data: {
                currentRevisionId: newRevision.id,
            },
            ...WikiPageApiPayloadArgs,
        });
    }

    const wikiPath = wikiParseCanonicalWikiPath(args.canonicalWikiPath);
    if (wikiPath.namespace?.toLowerCase() === SpecialWikiNamespace.EventDescription.toLowerCase()) {
        // for safety, now make sure the event is linked to this page. yes it's redundant, but safe.
        assert(currentPage.id === updatedPage.id, "Wiki page ID mismatch after update.");
        if (IsEntirelyIntegral(wikiPath.slugWithoutNamespace)) {
            const eventId = parseInt(wikiPath.slugWithoutNamespace);
            await dbt.event.update({
                where: { id: eventId },
                data: {
                    descriptionWikiPageId: currentPage.id,
                },
            });
        }
    }

    return {
        ...updatability,
        currentPage: updatedPage,
    };
};

const CreateWikiPage = async (args: TUpdateWikiPageArgs, currentUserId: number, dbt: TransactionalPrismaClient): Promise<GetWikiPageUpdatabilityResult> => {

    const visiblePermission = await getDefaultVisibilityPermission(dbt);

    // Page doesn't exist, create page and revision
    const wikiPath = wikiParseCanonicalWikiPath(args.canonicalWikiPath);
    const newWikiPage = await dbt.wikiPage.create({
        data: {
            slug: args.canonicalWikiPath,
            namespace: wikiPath.namespace,
            visiblePermissionId: visiblePermission?.id,
        },
        ...WikiPageApiPayloadArgs,
    });

    return await UpdateExistingWikiPage(args, newWikiPage, currentUserId, dbt);
};


// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTUpdateWikiPageArgs),
    async (args: TUpdateWikiPageArgs, ctx: AuthenticatedCtx): Promise<GetWikiPageUpdatabilityResult> => {

        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
        const changeContext = CreateChangeContext("updateWikiPage");

        return await db.$transaction(async (dbt) => {
            const wikiPage = await dbt.wikiPage.findUnique({
                where: { slug: args.canonicalWikiPath },
                ...WikiPageApiPayloadArgs,
            });
            let result: GetWikiPageUpdatabilityResult;
            if (wikiPage) {
                result = await UpdateExistingWikiPage(args, wikiPage, currentUser.id, dbt);
            } else {
                result = await CreateWikiPage(args, currentUser.id, dbt);
            }
            if (result.outcome === UpdateWikiPageResultOutcome.success) {
                await RegisterChange({
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

