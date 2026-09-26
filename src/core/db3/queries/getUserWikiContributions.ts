import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { z } from "zod";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { UserPublicIdSchema } from "src/auth/schemas";

const GetUserWikiContributionsInput = z.object({
    userId: UserPublicIdSchema,
});

export type GetUserWikiContributionsInputType = z.infer<typeof GetUserWikiContributionsInput>;

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_page_revisions),
    resolver.zod(GetUserWikiContributionsInput),
    async (input: GetUserWikiContributionsInputType, ctx: AuthenticatedCtx) => {
        const currentUser = await getCurrentUserCore(ctx);
        if (!currentUser) throw new Error("Current user was not found.");
        const target = await db.user.findUnique({ where: { publicId: input.userId }, select: { id: true } });
        if (!target) return { wikiContributions: [] };

        // Get distinct wiki pages where the user has made revisions
        const wikiContributions = await db.wikiPage.findMany({
            where: await GetAuthorizedTableReadWhere({
                table: xWikiPage,
                currentUser,
                where: {
                revisions: {
                    some: {
                        createdByUserId: target.id
                    }
                }
                },
            }),
            select: {
                slug: true,
                revisions: {
                    where: {
                        createdByUserId: target.id
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    select: {
                        createdAt: true,
                        createdByUser: {
                            select: {
                                publicId: true,
                                name: true,
                            }
                        }
                    }
                },
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
