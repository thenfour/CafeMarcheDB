import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { ZTAdminClearPageLockArgs, type TAdminClearPageLockArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { clearWikiLock } from "../server/wikiPageAdministration";

export default resolver.pipe(
    resolver.zod(ZTAdminClearPageLockArgs),
    async (args: TAdminClearPageLockArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, BandPermission.admin_wiki_pages, context => clearWikiLock(context, args)),
);
