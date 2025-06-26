import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { z } from "zod";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetUserVisibilityWhereExpression } from "src/core/db3/shared/db3Helpers";

const GetUserWikiContributionsInput = z.object({
    userId: z.number(),
});

export type GetUserWikiContributionsInputType = z.infer<typeof GetUserWikiContributionsInput>;

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_pages),
    resolver.zod(GetUserWikiContributionsInput),
    async (input: GetUserWikiContributionsInputType, ctx: AuthenticatedCtx) => {
        const currentUser = (await getCurrentUserCore(ctx))!;
        const visibilityPermission = GetUserVisibilityWhereExpression({
            id: currentUser.id,
            roleId: currentUser.roleId,
        });

        // Get distinct wiki pages where the user has made revisions
        const wikiContributions = await db.wikiPage.findMany({
            where: {
                ...visibilityPermission,
                revisions: {
                    some: {
                        createdByUserId: input.userId
                    }
                }
            },
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
