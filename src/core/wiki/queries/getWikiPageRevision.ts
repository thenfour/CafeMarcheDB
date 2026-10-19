import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
// returns a specific revision ID

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import db from "db";
import { executeDB3Read } from "src/core/db3/server/db3ReadExecution";
import { requireWikiAccess } from "../server/wikiAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { wikiPageRevisionDetailView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { TGetWikiPageRevisionArgs, ZTGetWikiPageRevisionArgs } from "src/core/wiki/shared/wikiUtils";

export default resolver.pipe(
    resolver.zod(ZTGetWikiPageRevisionArgs),
    async (args: TGetWikiPageRevisionArgs, ctx: AuthenticatedCtx) => {
        const authorization = await loadAuthorization(ctx.session, args.bandPublicId);
        return executeDB3Read(db, authorization, async context => {
            requireWikiAccess(context, BandPermission.view_wiki_page_revisions);
            if (!args.revisionId) {
                return null;
            }

            const result = await queryView({
                view: wikiPageRevisionDetailView,
                filter: { publicIds: [args.revisionId] },
                orderBy: undefined,
                take: 1,
                cmdbQueryContext: "wiki/revision-detail",
            }, context.authorization, context);
            return result.items[0] ?? null;
        });
    }
);



