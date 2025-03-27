// wikiRenewYourLock

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { TWikiReleaseYourLockArgs, ZTWikiReleaseYourLockArgs } from "src/core/wiki/shared/wikiUtils";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTWikiReleaseYourLockArgs),
    async (args: TWikiReleaseYourLockArgs, ctx: AuthenticatedCtx) => {

        await db.wikiPage.update({
            where: {
                slug: args.canonicalWikiPath,
                lockId: args.lockId,
                lockedByUserId: ctx.session.userId,
            },
            data: {
                lastEditPingAt: new Date(),
            }
        });
    }
);

