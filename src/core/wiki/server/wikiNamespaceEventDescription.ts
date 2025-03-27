import db, { Prisma } from "db";
import { IsEntirelyIntegral } from "shared/utils";
import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { SpecialWikiNamespace, wikiMakeWikiPathFromEventDescription, WikiNamespacePlugin, WikiPageData, WikiPageEventContext, WikiPageEventContextArgs } from "../../wiki/shared/wikiUtils";
import { GetWikiPageCore } from "./getWikiPageCore";

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

export async function getEventDescriptionInfoCore(event: Prisma.EventGetPayload<{ select: { name: true, id: true } }>, dbt: TransactionalPrismaClient): Promise<WikiPageData> {
    const path = wikiMakeWikiPathFromEventDescription(event);
    const page = await GetWikiPageCore({ canonicalWikiSlug: path.canonicalWikiPath, dbt });
    return page;
};

