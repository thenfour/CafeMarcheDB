import db from "db";
import { IsEntirelyIntegral } from "shared/utils";
import { SpecialWikiNamespace, WikiNamespacePlugin, WikiPageData, WikiPageEventContext, WikiPageEventContextArgs } from "../../wiki/shared/wikiUtils";

export const ProcessEventDescriptionForWikiPage: WikiNamespacePlugin = async (namespace: string, slugWithoutNamespace: string, inp: WikiPageData): Promise<WikiPageData> => {
    if (namespace.toLowerCase() !== SpecialWikiNamespace.EventDescription.toLowerCase()) {
        return inp;
    }
    if (!IsEntirelyIntegral(slugWithoutNamespace)) {
        return inp;
    }
    const eventId = parseInt(slugWithoutNamespace);

    // This is truly messed up, but typescript will crash if i query the event table here.
    // I have to avoid strong typing as a workaround.
    const eventContext = await (db.event as any).findUniqueOrThrow({
        where: { id: eventId },
        ...WikiPageEventContextArgs,
    }) as WikiPageEventContext;

    if (inp.wikiPage?.currentRevision) {
        inp.wikiPage.currentRevision.name = eventContext.name;
    }
    inp.titleIsEditable = false;
    inp.eventContext = eventContext;
    inp.specialWikiNamespace = SpecialWikiNamespace.EventDescription;

    return inp;
};
