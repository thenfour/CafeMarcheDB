import { assert } from "blitz";
import { Prisma } from "db";
import db from "db";
import { unslugify } from "shared/rootroot";
import { PermissionSignificance } from "../db3";
import { SpecialWikiNamespace, WikiPageArgsWithLatestRevision, WikiPageData, WikiPageEventContext, WikiPageEventContextArgs, WikiPageRecordInfo, WikiPageRevisionInfo, wikiParseCanonicalWikiPath } from "shared/wikiUtils";
import { GetPermissionIdBySignificance } from "../shared/apiTypes";
import { IsEntirelyIntegral } from "shared/utils";

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

export const GetWikiPageCore = async ({ slug }: { slug: string }): Promise<WikiPageData> => {
    const recordWithRevision = await db.wikiPage.findUnique({
        where: { slug },
        ...WikiPageArgsWithLatestRevision,
    });

    const x = await GetCoalescedPageAndRevision(slug, recordWithRevision);

    let currentTitle = x.revision.name;

    const namespace = slug.split("/")[0];
    const slugWithoutNamespace = slug.split("/")[1];
    let eventContext: null | WikiPageEventContext = null;
    let titleIsEditable = true;
    let specialWikiNamespace: SpecialWikiNamespace | null = null;

    // if the page is of a special namespace, the title should be calculated and uneditable.
    if (namespace === "EventDescription") {
        assert(slugWithoutNamespace, "EventDescription requires an ID");
        if (IsEntirelyIntegral(slugWithoutNamespace)) {
            eventContext = await db.event.findUnique({
                where: { id: parseInt(slugWithoutNamespace) },
                ...WikiPageEventContextArgs,
            });

            specialWikiNamespace = SpecialWikiNamespace.EventDescription;
            titleIsEditable = false;
            currentTitle = eventContext?.name || "<unknown>";
        }
    }

    x.revision.name = currentTitle;

    return {
        eventContext,
        wikiPage: x.page,
        latestRevision: x.revision,
        titleIsEditable,
        specialWikiNamespace,
        isExisting: x.page.id > 0,
    };
};
