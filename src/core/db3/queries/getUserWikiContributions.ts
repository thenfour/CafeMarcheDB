import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { UserPublicIdSchema } from "src/auth/schemas";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { executeDB3Read } from "src/core/db3/server/db3ReadExecution";
import { wikiPageRevisionContributionView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { requireWikiAccess } from "src/core/wiki/server/wikiAuthorization";
import { ZWikiBand } from "src/core/wiki/shared/wikiUtils";
import { z } from "zod";

const GetUserWikiContributionsInput = z.object({
    userId: UserPublicIdSchema,
    bandPublicId: ZWikiBand,
}).strict();

export type GetUserWikiContributionsInputType = z.infer<typeof GetUserWikiContributionsInput>;

export default resolver.pipe(
    resolver.zod(GetUserWikiContributionsInput),
    async (input: GetUserWikiContributionsInputType, ctx: AuthenticatedCtx) => {
        const authorization = await loadAuthorization(ctx.session, input.bandPublicId);
        return executeDB3Read(db, authorization, async context => {
            requireWikiAccess(context, Permission.view_wiki_page_revisions);
            const result = await queryView({
                view: wikiPageRevisionContributionView,
                filter: { tableParams: { userId: input.userId } },
                orderBy: { createdAt: "desc" },
                cmdbQueryContext: "wiki/user-contributions",
            }, context.authorization, context);

            const pages = new Map<string, {
                publicId: NonNullable<typeof result.items[number]["wikiPage"]>["publicId"];
                slug: string;
                revisions: {
                    createdAt: NonNullable<typeof result.items[number]["createdAt"]>;
                    createdByUser: typeof result.items[number]["createdByUser"];
                }[];
            }>();
            for (const revision of result.items) {
                if (!revision.wikiPage || !revision.wikiPage.slug || !revision.createdAt) {
                    throw new Error("Wiki contribution view returned an incomplete authorized row.");
                }
                let page = pages.get(revision.wikiPage.publicId);
                if (!page) {
                    page = {
                        publicId: revision.wikiPage.publicId,
                        slug: revision.wikiPage.slug,
                        revisions: [],
                    };
                    pages.set(page.publicId, page);
                }
                page.revisions.push({
                    createdAt: revision.createdAt,
                    createdByUser: revision.createdByUser ?? null,
                });
            }

            return { wikiContributions: [...pages.values()].sort((a, b) => a.slug.localeCompare(b.slug)) };
        });
    }
);
