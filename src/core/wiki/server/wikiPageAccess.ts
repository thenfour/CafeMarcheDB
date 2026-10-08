import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import { authorizeAndProjectViewDto, queryView } from "src/core/db3/server/db3QueryCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { eventWikiPageContextView } from "src/core/db3/shared/entities/event/eventViews";
import { wikiPageApiSelection, wikiPageApiView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { xEvent } from "src/core/db3/shared/schema/event";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { SpecialWikiNamespace, wikiParseCanonicalWikiPath } from "../shared/wikiUtils";
import { requireWikiAccess } from "./wikiAuthorization";

export async function findReadableWikiPage(context: DB3ReadContext, canonicalWikiPath: string) {
    const auth = requireWikiAccess(context, Permission.view_wiki_pages);
    return context.database.wikiPage.findFirst({
        where: await GetAuthorizedTableReadWhere({ table: xWikiPage, auth, where: { slug: canonicalWikiPath } }),
        ...wikiPageApiSelection,
    });
}

// simple wrapper around authorizeAndProjectViewDto
// throws
export function projectWikiPage(context: DB3ReadContext, row: NonNullable<Awaited<ReturnType<typeof findReadableWikiPage>>>) {
    const page = authorizeAndProjectViewDto(wikiPageApiView, row, context.authorization, "wiki/page");
    if (!page) {
        throw new AuthorizationError();
    }
    return page;
}

/** event descriptions are references to wiki pages; accessing them
 * requires validating their parent before creating or saving content.
 * not strictly necessary, but necessary for strictness
 *  */
export async function findWikiDescriptionEvent(context: DB3ReadContext, canonicalWikiPath: string) {
    const path = wikiParseCanonicalWikiPath(canonicalWikiPath);
    if (path.namespace?.toLowerCase() !== SpecialWikiNamespace.EventDescription.toLowerCase()) {
        return null;
    }
    if (!xEvent.isIdentity(path.slugWithoutNamespace)) {
        throw new AuthorizationError();
    }
    const result = await queryView({
        view: eventWikiPageContextView,
        filter: { tableParams: { eventId: xEvent.parseIdentity(path.slugWithoutNamespace) } },
        take: 1,
        cmdbQueryContext: "wiki/EventDescription",
    }, context.authorization, context);
    const event = result.items[0];
    if (!event) {
        throw new AuthorizationError();
    }
    return event;
}
