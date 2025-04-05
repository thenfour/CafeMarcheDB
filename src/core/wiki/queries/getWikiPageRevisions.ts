// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { GetWikiPageRevision } from "../server/getWikiPageCore";
import { TGetWikiPageRevisionsArgs, ZTGetWikiPageRevisionsArgs } from "../shared/wikiUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_pages),
    resolver.zod(ZTGetWikiPageRevisionsArgs),
    async (args: TGetWikiPageRevisionsArgs, ctx: AuthenticatedCtx) => {

        const page = await db.wikiPage.findUnique({
            where: { slug: args.canonicalWikiPath },
            include: {
                revisions: true,
                currentRevision: true,
            }
        });

        return page;

        // return await GetWikiPageRevision({
        //     canonicalWikiSlug: args.canonicalWikiPath,
        //     revisionId: args.revisionId,
        //     dbt: db
        // });
    }
);



