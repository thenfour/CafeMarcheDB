import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { ZTSetWikiPageVisibilityArgs, type TSetWikiPageVisibilityArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { setWikiVisibility } from "../server/wikiPageAdministration";

export default resolver.pipe(
    resolver.zod(ZTSetWikiPageVisibilityArgs),
    async (args: TSetWikiPageVisibilityArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, Permission.edit_wiki_pages, context => setWikiVisibility(context, args)),
);
