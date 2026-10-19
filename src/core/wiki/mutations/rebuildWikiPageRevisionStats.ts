import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { z } from "zod";
import { ZWikiBand } from "../shared/wikiUtils";
import { writeWiki } from "../server/wikiAuthorization";
import { rebuildWikiRevisionStats } from "../server/wikiPageAdministration";

export default resolver.pipe(
    resolver.zod(z.object({ bandPublicId: ZWikiBand }).strict()),
    async (args, ctx: AuthenticatedCtx) =>
        writeWiki(ctx.session, args.bandPublicId, BandPermission.admin_wiki_pages, rebuildWikiRevisionStats),
);
