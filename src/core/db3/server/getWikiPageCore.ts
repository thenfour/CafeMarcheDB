import db, { Prisma } from "db";
import { wikiMakeWikiPathFromEventDescription, WikiPageArgsWithLatestRevision, WikiPageData, WikiPageRecordInfo, WikiPageRevisionInfo, wikiParseCanonicalWikiPath } from "../shared/wikiUtils";
import { PermissionSignificance } from "../db3";
import { GetPermissionIdBySignificance } from "../shared/db3Helpers";
import { unslugify } from "shared/rootroot";
import { ProcessEventDescriptionForWikiPage } from "./wikiNamespaceEventDescription";

const MakeNewWikiPage = async (slug: string): Promise<WikiPageRecordInfo> => {
    return {
        slug,
        visiblePermissionId: await GetPermissionIdBySignificance(PermissionSignificance.Visibility_Members),
        id: -1,
    };
};

const MakeNewWikiPageRevision = (page: WikiPageRecordInfo): WikiPageRevisionInfo => {
    // the PAGE slug may have namespace.
    const path = wikiParseCanonicalWikiPath(page.slug);
    return {
        content: "",
        createdAt: new Date(),
        createdByUserId: null,
        createdByUser: null,
        id: -1,
        name: unslugify(path.slug),
        wikiPageId: page.id,
    };
};

const GetCoalescedPageAndRevision = async (slug: string, payload: Prisma.WikiPageGetPayload<typeof WikiPageArgsWithLatestRevision> | null): Promise<{ page: WikiPageRecordInfo, revision: WikiPageRevisionInfo }> => {
    if (!payload) {
        const page = await MakeNewWikiPage(slug);
        const revision = MakeNewWikiPageRevision(page);
        return { page, revision };
    }

    // separate page from revision.
    const { revisions, ...page } = payload;

    const latestRevision = payload.revisions[0];
    if (!latestRevision) {
        const revision = MakeNewWikiPageRevision(page);
        return { page, revision };
    }
    return { page, revision: latestRevision };
};

// async function ProcessEventDescriptionForWikiPage(slugWithoutNamespace: string, inp: WikiPageData): Promise<WikiPageData> {
//     const eventId = parseInt(slugWithoutNamespace);
//     // const eventContext = await db.event.findUniqueOrThrow({
//     //     where: { id: eventId },
//     //     ...WikiPageEventContextArgs,
//     // });
//     const eventContext = await db.wikiPage.findUniqueOrThrow({
//         where: { id: eventId },
//     });
//     //inp.latestRevision.name = eventContext.name;
//     inp.titleIsEditable = false;
//     //inp.eventContext = eventContext;
//     inp.specialWikiNamespace = SpecialWikiNamespace.EventDescription;
//     return inp;
// };

// const SpecialWikiNamespacePlugins = {
//     [SpecialWikiNamespace.EventDescription]: {
//         process: ProcessEventDescriptionForWikiPage,
//     },
// };

export async function GetWikiPageCore({ slug }: { slug: string }): Promise<WikiPageData> {
    const recordWithRevision = await db.wikiPage.findUnique({
        where: { slug },
        ...WikiPageArgsWithLatestRevision,
    });

    const x = await GetCoalescedPageAndRevision(slug, recordWithRevision);

    const namespace = slug.split("/")[0];
    const slugWithoutNamespace = slug.split("/")[1] || "";

    let ret: WikiPageData = {
        eventContext: null,
        wikiPage: x.page,
        latestRevision: x.revision,
        titleIsEditable: true,
        specialWikiNamespace: null,
        isExisting: x.page.id > 0,
    };

    // if the page is of a special namespace, the title should be calculated and uneditable.
    if (namespace) {
        //ret = await SpecialWikiNamespacePlugins[namespace]?.process(slugWithoutNamespace, ret);
        ret = await ProcessEventDescriptionForWikiPage(namespace, slugWithoutNamespace, ret);
    }

    return ret;
};


export async function getEventDescriptionInfoCore(event: Prisma.EventGetPayload<{ select: { name: true, id: true } }>) {
    const path = wikiMakeWikiPathFromEventDescription(event);
    const page = await GetWikiPageCore({ slug: path.canonicalWikiPath });
    return page;
};

