import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { z } from "zod";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";

const GetUserWikiContributionsInput = z.object({
    userId: z.number(),
});

export type GetUserWikiContributionsInputType = z.infer<typeof GetUserWikiContributionsInput>;

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_page_revisions),
    resolver.zod(GetUserWikiContributionsInput),
    async (input: GetUserWikiContributionsInputType, ctx: AuthenticatedCtx) => {
        const currentUser = await getCurrentUserCore(ctx);
        if (!currentUser) throw new Error("Current user was not found.");

        // Get distinct wiki pages where the user has made revisions
        const wikiContributions = await db.wikiPage.findMany({
            where: await GetAuthorizedTableReadWhere({
                table: xWikiPage,
                currentUser,
                where: {
                revisions: {
                    some: {
                        createdByUserId: input.userId
                    }
                }
                },
            }),
            include: {
                revisions: {
                    where: {
                        createdByUserId: input.userId
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    include: {
                        createdByUser: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                },
                visiblePermission: true,
            },
            orderBy: {
                slug: 'asc'
            }
        });

        return {
            wikiContributions
        };
    }
);
