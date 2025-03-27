// it's just less effort to make this mutation for this single field than to use db3 superimposed over
// all this custom stuff.
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { TSetWikiPageVisibilityArgs, ZTSetWikiPageVisibilityArgs } from "src/core/wiki/shared/wikiUtils";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_wiki_pages),
    resolver.zod(ZTSetWikiPageVisibilityArgs),
    async (args: TSetWikiPageVisibilityArgs, ctx: AuthenticatedCtx): Promise<void> => {
        await db.wikiPage.update({
            where: {
                slug: args.canonicalWikiPath,
            },
            data: {
                visiblePermissionId: args.visiblePermissionId,
            },
        });

    }
);

