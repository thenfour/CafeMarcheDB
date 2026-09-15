import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { GetWikiPageUpdatability, WikiPageApiPayloadArgs, WikiPageData, wikiParseCanonicalWikiPath } from "../../wiki/shared/wikiUtils";
import { ProcessEventDescriptionForWikiPage } from "./wikiNamespaceEventDescription";
import { AuthenticatedCtx } from "blitz";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";

interface GetWikiPageCoreArgs {
    canonicalWikiSlug: string;
    currentUserId: number | null;
    clientBaseContentVersion: number;
    clientBaseRevisionId: number | null;
    clientLockId: string | null;
    ctx: AuthenticatedCtx;
    dbt: TransactionalPrismaClient;
};

export async function GetWikiPageCore({ canonicalWikiSlug, dbt, ctx, ...args }: GetWikiPageCoreArgs): Promise<WikiPageData> {

    const currentUser = await getCurrentUserCore(ctx);
    if (!currentUser) throw new Error("Current user was not found.");

    const page = await dbt.wikiPage.findFirst({
        where: await GetAuthorizedTableReadWhere({
            table: xWikiPage,
            currentUser,
            where: { slug: canonicalWikiSlug },
        }),
        ...WikiPageApiPayloadArgs,
    });

    const path = wikiParseCanonicalWikiPath(canonicalWikiSlug);
    const lockStatus = GetWikiPageUpdatability({
        currentPage: page,
        currentUserId: args.currentUserId,
        userClientLockId: args.clientLockId,
        baseRevisionId: args.clientBaseRevisionId,
        baseContentVersion: args.clientBaseContentVersion,
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
