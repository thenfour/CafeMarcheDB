import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { ZTUpdateWikiPageArgs, type TUpdateWikiPageArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { saveWikiPage } from "../server/wikiPageEditing";

export default resolver.pipe(
    resolver.zod(ZTUpdateWikiPageArgs),
    async (args: TUpdateWikiPageArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, Permission.edit_wiki_pages, context => saveWikiPage(context, args)),
);
