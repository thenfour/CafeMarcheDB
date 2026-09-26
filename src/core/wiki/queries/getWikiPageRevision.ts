// returns a specific revision ID

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/requestAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { wikiPageRevisionDetailView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { TGetWikiPageRevisionArgs, ZTGetWikiPageRevisionArgs } from "src/core/wiki/shared/wikiUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_page_revisions),
    resolver.zod(ZTGetWikiPageRevisionArgs),
    async (args: TGetWikiPageRevisionArgs, ctx: AuthenticatedCtx) => {
        if (!args.revisionId) {
            return null;
        }

        const authorization = await loadAuthorization(ctx.session);
        const result = await queryView({
            view: wikiPageRevisionDetailView,
            filter: { pks: [args.revisionId] },
            orderBy: undefined,
            take: 1,
            cmdbQueryContext: "wiki/revision-detail",
        }, authorization);
        return result.items[0] ?? null;
    }
);



