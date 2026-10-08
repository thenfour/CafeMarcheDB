import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { xWikiPageRevision } from "src/core/db3/shared/schema/wiki";
import { writeWiki } from "../server/wikiAuthorization";
import { deleteWikiPageRevision } from "../server/wikiPageAdministration";
import { ZWikiBand } from "../shared/wikiUtils";

export default resolver.pipe(
    resolver.zod(z.object({ bandPublicId: ZWikiBand, revisionId: xWikiPageRevision.identitySchema }).strict()),
    async (args, ctx: AuthenticatedCtx) => writeWiki(ctx.session, args.bandPublicId,
        Permission.admin_wiki_pages, context => deleteWikiPageRevision(context, args.revisionId)),
);
