import { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { GetWikiPageUpdatability, WikiPageApiPayloadArgs, WikiPageData, wikiParseCanonicalWikiPath } from "../../wiki/shared/wikiUtils";
import { ProcessEventDescriptionForWikiPage } from "./wikiNamespaceEventDescription";
import { AuthenticatedCtx } from "blitz";
import { GetUserVisibilityWhereExpression } from "src/core/db3/shared/db3Helpers";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";

interface GetWikiPageCoreArgs {
    canonicalWikiSlug: string;
    currentUserId: number | null;
    clientBaseRevisionId: number | null;
    clientLockId: string | null;
    ctx: AuthenticatedCtx;
    dbt: TransactionalPrismaClient;
};

export async function GetWikiPageCore({ canonicalWikiSlug, dbt, ctx, ...args }: GetWikiPageCoreArgs): Promise<WikiPageData> {

    const currentUser = (await getCurrentUserCore(ctx))!;
    const visibilityPermission = GetUserVisibilityWhereExpression({
        id: currentUser.id,
        roleId: currentUser.roleId,
    });

    const page = await dbt.wikiPage.findUnique({
        where: {
            slug: canonicalWikiSlug,
            ...visibilityPermission
        },
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


interface GetWikiPageRevisionCoreArgs {
    canonicalWikiSlug: string;
    revisionId: number;
    dbt: TransactionalPrismaClient;
};


export async function GetWikiPageRevision({ canonicalWikiSlug, revisionId, dbt, ...args }: GetWikiPageRevisionCoreArgs) {
    // const page = await dbt.wikiPage.findUnique({
    //     where: { slug: canonicalWikiSlug },
    //     ...WikiPageApiPayloadArgs,
    // });

    //const path = wikiParseCanonicalWikiPath(canonicalWikiSlug);

    const revision = await dbt.wikiPageRevision.findUnique({
        where: { id: revisionId },
        include: {
            wikiPage: true,
        },
    });

    return revision;

    // const lockStatus = GetWikiPageUpdatability({
    //     currentPage: page,
    //     currentUserId: args.currentUserId,
    //     userClientLockId: args.clientLockId,
    //     baseRevisionId: args.clientBaseRevisionId,
    // });

    // let ret: WikiPageData = {
    //     eventContext: null,
    //     wikiPage: page,// || await MakeNewWikiPage(slug),
    //     titleIsEditable: true,
    //     specialWikiNamespace: null,
    //     isExisting: !!page && page.id > 0,
    //     lockStatus,
    // };

    // if the page is of a special namespace, the title should be calculated and uneditable.
    // if (path.namespace) {
    //     ret = await ProcessEventDescriptionForWikiPage(path.namespace, path.slugWithoutNamespace, ret);
    // }

    //return ret;
};
