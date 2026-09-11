// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { TGetWikiPageRevisionsArgs, ZTGetWikiPageRevisionsArgs } from "../shared/wikiUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_page_revisions),
    resolver.zod(ZTGetWikiPageRevisionsArgs),
    async (args: TGetWikiPageRevisionsArgs, ctx: AuthenticatedCtx) => {
        const currentUser = await getCurrentUserCore(ctx);
        if (!currentUser) throw new Error("Current user was not found.");

        const page = await db.wikiPage.findFirst({
            where: await GetAuthorizedTableReadWhere({
                table: xWikiPage,
                currentUser,
                where: { slug: args.canonicalWikiPath },
            }),
            include: {
                revisions: true,
                currentRevision: true,
            }
        });

        return page;
    }
);



