import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { ZTSetWikiPageVisibilityArgs, type TSetWikiPageVisibilityArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { setWikiVisibility } from "../server/wikiPageAdministration";

export default resolver.pipe(
    resolver.zod(ZTSetWikiPageVisibilityArgs),
    async (args: TSetWikiPageVisibilityArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, BandPermission.edit_wiki_pages, context => setWikiVisibility(context, args)),
);
