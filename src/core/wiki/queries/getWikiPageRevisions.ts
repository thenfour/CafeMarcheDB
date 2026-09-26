import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/requestAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { wikiPageRevisionHistoryView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { TGetWikiPageRevisionsArgs, ZTGetWikiPageRevisionsArgs } from "../shared/wikiUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_page_revisions),
    resolver.zod(ZTGetWikiPageRevisionsArgs),
    async (args: TGetWikiPageRevisionsArgs, ctx: AuthenticatedCtx) => {
        const authorization = await loadAuthorization(ctx.session);
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
        }, authorization);
        return result.items[0] ?? null;
    }
);



