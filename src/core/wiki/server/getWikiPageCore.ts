import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { GetWikiPageUpdatability, WikiPageData, wikiParseCanonicalWikiPath } from "../../wiki/shared/wikiUtils";
import { ProcessEventDescriptionForWikiPage } from "./wikiNamespaceEventDescription";
import { AuthenticatedCtx } from "blitz";
import { loadAuthorization } from "src/auth/server/requestAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { wikiPageApiView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { xUser } from "src/core/db3/shared/schema/user";

interface GetWikiPageCoreArgs {
    canonicalWikiSlug: string;
    clientBaseContentVersion: number;
    clientBaseRevisionId: number | null;
    clientLockId: string | null;
    ctx: AuthenticatedCtx;
    dbt: TransactionalPrismaClient;
};

export async function GetWikiPageCore({ canonicalWikiSlug, dbt, ctx, ...args }: GetWikiPageCoreArgs): Promise<WikiPageData> {

    const authorization = await loadAuthorization(ctx.session);
    const currentUser = authorization.user;
    if (!currentUser) throw new Error("Current user was not found.");

    const result = await queryView({
        view: wikiPageApiView,
        filter: {
            items: [{ field: "slug", operator: "equals", value: canonicalWikiSlug }],
        },
        orderBy: undefined,
        take: 1,
        cmdbQueryContext: "wiki/page",
    }, authorization, dbt);
    const page = result.items[0] ?? null;

    const path = wikiParseCanonicalWikiPath(canonicalWikiSlug);
    const lockStatus = GetWikiPageUpdatability({
        currentPage: page,
        currentUserId: xUser.parseIdentity(currentUser.publicId),
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
        ret = await ProcessEventDescriptionForWikiPage(
            path.namespace,
            path.slugWithoutNamespace,
            ret,
            authorization,
            dbt,
        );
    }

    return ret;
};
