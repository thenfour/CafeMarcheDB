import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { TAdminClearPageLockArgs, ZTAdminClearPageLockArgs } from "src/core/wiki/shared/wikiUtils";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.admin_wiki_pages),
    resolver.zod(ZTAdminClearPageLockArgs),
    async (args: TAdminClearPageLockArgs, ctx: AuthenticatedCtx): Promise<void> => {
        await db.wikiPage.update({
            where: {
                slug: args.canonicalWikiPath,
            },
            data: {
                lockId: null,
                lockAcquiredAt: null,
                lockExpiresAt: null,
                lockedByUserId: null,
                lastEditPingAt: null,
            },
        });

    }
);

