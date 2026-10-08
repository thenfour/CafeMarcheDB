import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { ZTWikiReleaseYourLockArgs, type TWikiReleaseYourLockArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { releaseWikiLock } from "../server/wikiPageAdministration";

export default resolver.pipe(
    resolver.zod(ZTWikiReleaseYourLockArgs),
    async (args: TWikiReleaseYourLockArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, Permission.edit_wiki_pages, context => releaseWikiLock(context, args)),
);
