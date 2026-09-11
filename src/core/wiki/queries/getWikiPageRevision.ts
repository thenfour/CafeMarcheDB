// returns a specific revision ID

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { TGetWikiPageRevisionArgs, ZTGetWikiPageRevisionArgs } from "src/core/wiki/shared/wikiUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_page_revisions),
    resolver.zod(ZTGetWikiPageRevisionArgs),
    async (args: TGetWikiPageRevisionArgs, ctx: AuthenticatedCtx) => {
        if (!args.revisionId) {
            return null;
        }
        const currentUser = await getCurrentUserCore(ctx);
        if (!currentUser) throw new Error("Current user was not found.");
        const wikiPageWhere = await GetAuthorizedTableReadWhere({
            table: xWikiPage,
            currentUser,
        });

        const page = await db.wikiPageRevision.findFirst({
            where: {
                id: args.revisionId,
                wikiPage: wikiPageWhere,
            },
            include: {
                wikiPage: true,
            }
        });

        return page;
    }
);



