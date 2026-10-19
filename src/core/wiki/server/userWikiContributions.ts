import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { AuthorizationError } from "blitz";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import type { DtoOf } from "src/core/db3/shared/core/db3View";
import { wikiPageRevisionContributionView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { ZTGetUserWikiContributionsArgs, type GetUserWikiContributionsInputType } from "../shared/wikiUtils";
import { requireWikiAccess } from "./wikiAuthorization";

type ContributionRevision = DtoOf<typeof wikiPageRevisionContributionView>;
interface ContributedPage {
    publicId: NonNullable<ContributionRevision["wikiPage"]>["publicId"];
    slug: string;
    revisions: {
        createdAt: NonNullable<ContributionRevision["createdAt"]>;
        createdByUser: ContributionRevision["createdByUser"];
    }[];
}

function groupContributionsByPage(revisions: readonly ContributionRevision[]): ContributedPage[] {
    const pages = new Map<ContributedPage["publicId"], ContributedPage>();
    for (const revision of revisions) {
        if (!revision.wikiPage || !revision.wikiPage.slug || !revision.createdAt) {
            throw new Error("Wiki contribution view returned an incomplete authorized row.");
        }
        let page = pages.get(revision.wikiPage.publicId);
        if (!page) {
            page = { publicId: revision.wikiPage.publicId, slug: revision.wikiPage.slug, revisions: [] };
            pages.set(page.publicId, page);
        }
        page.revisions.push({ createdAt: revision.createdAt, createdByUser: revision.createdByUser ?? null });
    }
    return [...pages.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export function readUserWikiContributions(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: GetUserWikiContributionsInputType,
) {
    const args = ZTGetUserWikiContributionsArgs.parse(input);
    return executeDB3Read(database, authorization, async context => {
        const auth = requireWikiAccess(context, BandPermission.view_wiki_page_revisions);
        if (auth.requireBand().publicId !== args.bandPublicId) {
            throw new AuthorizationError("Wiki contributions require the selected band.");
        }
        const result = await queryView({
            view: wikiPageRevisionContributionView,
            filter: { tableParams: { userId: args.userId } },
            orderBy: { createdAt: "desc" },
            cmdbQueryContext: "wiki/user-contributions",
        }, context.authorization, context);
        return { wikiContributions: groupContributionsByPage(result.items) };
    });
}
