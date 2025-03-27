import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { WikiPageApiPayloadArgs, WikiPageData, wikiParseCanonicalWikiPath } from "../../wiki/shared/wikiUtils";
import { ProcessEventDescriptionForWikiPage } from "./wikiNamespaceEventDescription";

export async function GetWikiPageCore({ canonicalWikiSlug, dbt }: { canonicalWikiSlug: string, dbt: TransactionalPrismaClient }): Promise<WikiPageData> {
    const page = await dbt.wikiPage.findUnique({
        where: { slug: canonicalWikiSlug },
        ...WikiPageApiPayloadArgs,
    });

    const path = wikiParseCanonicalWikiPath(canonicalWikiSlug);

    let ret: WikiPageData = {
        eventContext: null,
        wikiPage: page,// || await MakeNewWikiPage(slug),
        titleIsEditable: true,
        specialWikiNamespace: null,
        isExisting: !!page && page.id > 0,
    };

    // if the page is of a special namespace, the title should be calculated and uneditable.
    if (path.namespace) {
        ret = await ProcessEventDescriptionForWikiPage(path.namespace, path.slugWithoutNamespace, ret);
    }

    return ret;
};
