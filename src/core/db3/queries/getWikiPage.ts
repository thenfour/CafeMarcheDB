// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, SplitQuickFilter, assertIsNumberArray, mysql_real_escape_string } from "shared/utils";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { TGetWikiPageArgs } from "../shared/apiTypes";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_pages),
    async (args: TGetWikiPageArgs, ctx: AuthenticatedCtx) => {
        const ret = await db.wikiPage.findUnique({
            where: { slug: args.slug },
            select: {
                slug: true,
                revisions: { // take only the 1st most recent revision
                    take: 1,
                    orderBy: {
                        createdAt: 'desc'
                    },
                    include: {
                        wikiPage: {
                            include: {
                                visiblePermission: true,
                            }
                        },
                        createdByUser: true,
                    }
                },
            },
        });
        return ret;
    }
);



