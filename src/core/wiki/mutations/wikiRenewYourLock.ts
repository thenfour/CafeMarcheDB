import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { ZTWikiReleaseYourLockArgs, type TWikiReleaseYourLockArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { renewWikiLock } from "../server/wikiPageAdministration";

export default resolver.pipe(
    resolver.zod(ZTWikiReleaseYourLockArgs),
    async (args: TWikiReleaseYourLockArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, BandPermission.edit_wiki_pages, context => renewWikiLock(context, args)),
);
