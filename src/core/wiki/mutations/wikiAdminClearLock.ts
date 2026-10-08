import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { ZTAdminClearPageLockArgs, type TAdminClearPageLockArgs } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { clearWikiLock } from "../server/wikiPageAdministration";

export default resolver.pipe(
    resolver.zod(ZTAdminClearPageLockArgs),
    async (args: TAdminClearPageLockArgs, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, Permission.admin_wiki_pages, context => clearWikiLock(context, args)),
);
