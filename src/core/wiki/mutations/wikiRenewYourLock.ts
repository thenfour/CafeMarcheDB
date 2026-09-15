import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
// wikiRenewYourLock

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { GetDateSecondsFromNow } from "shared/time";
import { gWikiPageLockDurationSeconds, TWikiReleaseYourLockArgs, ZTWikiReleaseYourLockArgs } from "src/core/wiki/shared/wikiUtils";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTWikiReleaseYourLockArgs),
    async (args: TWikiReleaseYourLockArgs, ctx: AuthenticatedCtx) => {

        const currentUser = (await getCurrentUserCore(ctx))!;
        const readable = await GetAuthorizedTableReadWhere({ table: xWikiPage, currentUser });
        const result = await db.wikiPage.updateMany({
            where: {
                AND: [readable],
                slug: args.canonicalWikiPath,
                lockId: args.lockId,
                lockedByUserId: ctx.session.userId,
                lockExpiresAt: { gt: new Date() },
            },
            data: {
                lockExpiresAt: GetDateSecondsFromNow(gWikiPageLockDurationSeconds),
                lastEditPingAt: new Date(),
            },
        });
        return result.count === 1;
    }
);

