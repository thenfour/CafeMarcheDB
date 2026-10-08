import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import db from "db";
import { executeDB3Read } from "src/core/db3/server/db3ReadExecution";
import { requireWikiAccess } from "../server/wikiAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { wikiPageRevisionHistoryView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { TGetWikiPageRevisionsArgs, ZTGetWikiPageRevisionsArgs } from "../shared/wikiUtils";

export default resolver.pipe(
    resolver.zod(ZTGetWikiPageRevisionsArgs),
    async (args: TGetWikiPageRevisionsArgs, ctx: AuthenticatedCtx) => {
        const authorization = await loadAuthorization(ctx.session, args.bandPublicId);
        return executeDB3Read(db, authorization, async context => {
            requireWikiAccess(context, Permission.view_wiki_page_revisions);
            const result = await queryView({
                view: wikiPageRevisionHistoryView,
                filter: {
                    items: [{
                        field: "slug",
                        operator: "equals",
                        value: args.canonicalWikiPath,
                    }],
                },
                orderBy: undefined,
                take: 1,
                cmdbQueryContext: "wiki/revision-history",
            }, context.authorization, context);
            return result.items[0] ?? null;
        });
    }
);



