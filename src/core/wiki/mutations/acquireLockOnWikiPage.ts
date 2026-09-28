import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
import { wikiTransaction } from "../server/wikiTransaction";
// acquireLockOnWikiPage

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { GetDateSecondsFromNow } from "shared/time";
import * as db3 from "src/core/db3/db3";
import { authorizeAndProjectViewDto } from "src/core/db3/server/db3QueryCore";
import { GetWikiPageUpdatability, GetWikiPageUpdatabilityResult, gWikiPageLockDurationSeconds, TAcquireLockOnWikiPageArgs, WikiPageApiPayload, wikiParseCanonicalWikiPath, ZTAcquireLockOnWikiPageArgs } from "src/core/wiki/shared/wikiUtils";
import { GetDefaultVisibilityPermission } from "../../db3/server/db3Helpers";
import { GetAuthorizedTableReadWhere } from "../../db3/server/db3ReadPolicy";
import { xWikiPage } from "../../db3/shared/schema/wiki";
import { wikiPageApiSelection } from "../../db3/shared/entities/wiki/wikiViews";
import { generatePublicId } from "src/server/publicId";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTAcquireLockOnWikiPageArgs),
    async (args: TAcquireLockOnWikiPageArgs, ctx: AuthenticatedCtx): Promise<GetWikiPageUpdatabilityResult> => {

        const auth = (await loadAuthorization(ctx.session)).requireUser();
        const currentUser = auth.user;

        return await wikiTransaction(async (dbt) => {

            // get latest page & check if we can acquire lock.
            const currentPageRow = await dbt.wikiPage.findFirst({
                where: await GetAuthorizedTableReadWhere({
                    table: xWikiPage,
                    auth: auth,
                    where: { slug: args.canonicalWikiPath },
                }),
                ...wikiPageApiSelection,
            });
            let currentPage: WikiPageApiPayload | null = currentPageRow
                ? authorizeAndProjectViewDto(
                    db3.wikiPageApiView,
                    currentPageRow,
                    auth,
                    "mutation:WikiPage.acquireLock",
                )
                : null;

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
                const wikiPath = wikiParseCanonicalWikiPath(args.canonicalWikiPath);
                const visPerm = await GetDefaultVisibilityPermission(dbt);
                const createdPage = await dbt.wikiPage.create({
                    data: {
                        publicId: generatePublicId<"WikiPage">(),
                        slug: args.canonicalWikiPath,
                        namespace: wikiPath.namespace,
                        visiblePermissionId: visPerm?.id || null,
                        createdByUserId: currentUser.id,
                    },
                    ...wikiPageApiSelection,
                });
                currentPage = authorizeAndProjectViewDto(
                    db3.wikiPageApiView,
                    createdPage,
                    auth,
                    "mutation:WikiPage.acquireLock.create",
                );
                if (!currentPage) throw new Error("Created wiki page was not authorized for reading.");
                currentPageNaturalId = createdPage.id;
            }

            // now acquire the lock
            if (currentPageNaturalId === undefined) throw new Error("Wiki page has no database identity.");
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
            currentPage = authorizeAndProjectViewDto(
                db3.wikiPageApiView,
                updatedPage,
                auth,
                "mutation:WikiPage.acquireLock.update",
            );
            if (!currentPage) throw new Error("Updated wiki page was not authorized for reading.");

            return {
                ...GetWikiPageUpdatability({
                    currentPage, currentUserPublicId: auth.userPublicId,
                    userClientLockId: args.lockId, baseRevisionId: args.baseRevisionId,
                    baseContentVersion: args.baseContentVersion
                }),
            }
        });
    }
);

