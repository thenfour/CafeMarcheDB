// acquireLockOnWikiPage

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { GetDateSecondsFromNow } from "shared/time";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetWikiPageUpdatability, GetWikiPageUpdatabilityResult, gWikiPageLockDurationSeconds, TAcquireLockOnWikiPageArgs, WikiPageApiPayload, WikiPageApiPayloadArgs, wikiParseCanonicalWikiPath, ZTAcquireLockOnWikiPageArgs } from "src/core/wiki/shared/wikiUtils";
import { GetDefaultVisibilityPermission } from "../../db3/shared/db3Helpers";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTAcquireLockOnWikiPageArgs),
    async (args: TAcquireLockOnWikiPageArgs, ctx: AuthenticatedCtx): Promise<GetWikiPageUpdatabilityResult> => {

        const currentUser = (await getCurrentUserCore(ctx))!;

        return await db.$transaction(async (dbt) => {

            // get latest page & check if we can acquire lock.
            let currentPage: WikiPageApiPayload | null = await dbt.wikiPage.findUnique({
                where: { slug: args.canonicalWikiPath },
                ...WikiPageApiPayloadArgs,
            });

            const updatability = GetWikiPageUpdatability({
                currentPage: currentPage,
                currentUserId: ctx.session.userId,
                baseRevisionId: args.baseRevisionId,
                userClientLockId: args.lockId,
            });

            if (updatability.isLockConflict || updatability.isRevisionConflict) {
                return updatability;
            }

            // we are clear: acquire lock.

            // page must be created in order to store lock info.
            if (!currentPage) {
                const wikiPath = wikiParseCanonicalWikiPath(args.canonicalWikiPath);
                const visPerm = await GetDefaultVisibilityPermission(dbt);
                currentPage = await dbt.wikiPage.create({
                    data: {
                        slug: args.canonicalWikiPath,
                        namespace: wikiPath.namespace,
                        visiblePermissionId: visPerm?.id || null,
                        createdByUserId: currentUser.id,
                    },
                    ...WikiPageApiPayloadArgs,
                });
            }

            // now acquire the lock
            currentPage = await dbt.wikiPage.update({
                where: { id: currentPage.id },
                data: {
                    lockId: args.lockId,
                    lockAcquiredAt: new Date(),
                    lastEditPingAt: new Date(),
                    lockExpiresAt: GetDateSecondsFromNow(gWikiPageLockDurationSeconds),
                    lockedByUserId: currentUser.id,
                },
                ...WikiPageApiPayloadArgs,
            });

            return {
                ...updatability,
                ...currentPage,
            }
        });
    }
);

