import type { Prisma } from "@prisma/client";
import { MakeWhereCondition, type ParseQuickFilterResult, type SearchableTableFieldSpec } from "shared/quickFilter";
import { xWikiPage, xWikiPageCurrentRevision } from "../shared/schema/wiki";
import type { DB3ReadContext } from "./db3ReadExecution";
import { GetAuthorizedTableReadWhere } from "./db3ReadPolicy";

/** Current content belongs to its visible page, even if a stored revision pointer is malformed. */
export async function readMatchingCurrentWikiRevisions(context: DB3ReadContext, query: ParseQuickFilterResult,
    fields: SearchableTableFieldSpec[], pageFilter: Prisma.WikiPageWhereInput,
) {
    const auth = context.authorization;
    if (!xWikiPage.authorizeTableForView(auth) || !xWikiPageCurrentRevision.authorizeTableForView(auth)) {
        return [];
    }
    const pageWhere = await GetAuthorizedTableReadWhere({
        table: xWikiPage,
        auth,
        where: pageFilter
    });
    const revisionWhere = await GetAuthorizedTableReadWhere({
        table: xWikiPageCurrentRevision,
        auth,
        where: MakeWhereCondition(fields, query)
    });
    const revisions = await context.database.wikiPageRevision.findMany({
        select: {
            id: true,
            name: true,
            content: true,
            wikiPage: {
                select: {
                    id: true,
                    publicId: true,
                    slug: true,
                    currentRevisionId: true
                }
            }
        },
        where: {
            AND: [
                revisionWhere,
                { wikiPage: pageWhere, pageAsCurrent: pageWhere }
            ]
        },
    });
    return revisions.filter(revision => revision.wikiPage.currentRevisionId === revision.id);
}
