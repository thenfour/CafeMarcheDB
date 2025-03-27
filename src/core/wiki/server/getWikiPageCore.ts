import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { GetWikiPageUpdatability, WikiPageApiPayloadArgs, WikiPageData, wikiParseCanonicalWikiPath } from "../../wiki/shared/wikiUtils";
import { ProcessEventDescriptionForWikiPage } from "./wikiNamespaceEventDescription";

interface GetWikiPageCoreArgs {
    canonicalWikiSlug: string;
    currentUserId: number | null;
    clientBaseRevisionId: number | null;
    clientLockId: string | null;
    dbt: TransactionalPrismaClient;
};

export async function GetWikiPageCore({ canonicalWikiSlug, dbt, ...args }: GetWikiPageCoreArgs): Promise<WikiPageData> {
    const page = await dbt.wikiPage.findUnique({
        where: { slug: canonicalWikiSlug },
        ...WikiPageApiPayloadArgs,
    });

    const path = wikiParseCanonicalWikiPath(canonicalWikiSlug);
    const lockStatus = GetWikiPageUpdatability({
        currentPage: page,
        currentUserId: args.currentUserId,
        userClientLockId: args.clientLockId,
        baseRevisionId: args.clientBaseRevisionId,
    });

    let ret: WikiPageData = {
        eventContext: null,
        wikiPage: page,// || await MakeNewWikiPage(slug),
        titleIsEditable: true,
        specialWikiNamespace: null,
        isExisting: !!page && page.id > 0,
        lockStatus,
    };

    // if the page is of a special namespace, the title should be calculated and uneditable.
    if (path.namespace) {
        ret = await ProcessEventDescriptionForWikiPage(path.namespace, path.slugWithoutNamespace, ret);
    }

    return ret;
};

