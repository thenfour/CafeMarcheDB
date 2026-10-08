import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { ZTAcquireLockOnWikiPageArgs, type TAcquireLockOnWikiPageArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { acquireWikiLock } from "../server/wikiPageEditing";

export default resolver.pipe(
    resolver.zod(ZTAcquireLockOnWikiPageArgs),
    async (args: TAcquireLockOnWikiPageArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, Permission.edit_wiki_pages, context => acquireWikiLock(context, args)),
);
