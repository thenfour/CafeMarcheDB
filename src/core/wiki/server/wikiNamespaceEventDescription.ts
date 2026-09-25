import { isPublicId } from "shared/publicId";
import type { RequestAuthorization } from "src/auth/server/requestAuthorization";
import { DB3ReferenceStore } from "../../db3/shared/core/db3Hydration";
import { eventWikiPageContextView } from "../../db3/shared/entities/event/eventViews";
import { queryView } from "../../db3/server/db3QueryCore";
import type { TransactionalPrismaClient } from "../../db3/shared/apiTypes";
import { SpecialWikiNamespace, WikiPageData } from "../../wiki/shared/wikiUtils";
import * as db3 from "../../db3/db3";



// under the "EventDescription" wiki namespace, we attach some event info to the
// wiki context for a more ergonomic experience.
export const ProcessEventDescriptionForWikiPage = async (
    namespace: string,
    slugWithoutNamespace: string,
    inp: WikiPageData,
    authorization: RequestAuthorization,
    database: TransactionalPrismaClient,
): Promise<WikiPageData> => {
    if (namespace.toLowerCase() !== SpecialWikiNamespace.EventDescription.toLowerCase()) {
        return inp;
    }
    if (!isPublicId(slugWithoutNamespace)) {
        return inp;
    }
    const eventId = db3.xEvent.parseIdentity(slugWithoutNamespace);

    const result = await queryView({
        view: eventWikiPageContextView,
        filter: { items: [], tableParams: { eventId } },
        orderBy: undefined,
        take: 1,
        cmdbQueryContext: "wiki/EventDescription",
    }, authorization, new DB3ReferenceStore(), database);
    const eventContext = result.items[0];
    if (!eventContext) throw new Error(`Event ${eventId} was not found.`);

    if (inp.wikiPage?.currentRevision) {
        inp.wikiPage.currentRevision.name = eventContext.name;
    }
    inp.titleIsEditable = false;
    inp.eventContext = eventContext;
    inp.specialWikiNamespace = SpecialWikiNamespace.EventDescription;

    return inp;
};
