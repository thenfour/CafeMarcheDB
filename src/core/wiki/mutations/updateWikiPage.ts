// updateWikiPage
import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import db from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { GetDateSecondsFromNow } from "shared/time";
import { IsEntirelyIntegral } from "shared/utils";
import * as mutationCore from "src/core/db3/server/db3mutationCore";
import { getDefaultVisibilityPermission } from "src/core/db3/server/serverPermissionUtils";
import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { GetWikiPageUpdatability, GetWikiPageUpdatabilityResult, gWikiPageLockDurationSeconds, SpecialWikiNamespace, TUpdateWikiPageArgs, UpdateWikiPageResultOutcome, WikiPageApiPayload, WikiPageApiPayloadArgs, WikiPageApiRevisionPayloadArgs, wikiParseCanonicalWikiPath, ZTUpdateWikiPageArgs } from "src/core/wiki/shared/wikiUtils";

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

    // Page exists, add new revision
    const newRevision = await dbt.wikiPageRevision.create({
        data: {
            name: args.title,
            content: args.content,
            createdByUserId: currentUserId,
            wikiPageId: currentPage.id,
        },
        ...WikiPageApiRevisionPayloadArgs,
    });

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

