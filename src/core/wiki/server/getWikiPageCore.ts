import { Permission } from "shared/permissions";
import type { WikiPageRevisionPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import { requireWikiAccess } from "./wikiAuthorization";
import { wikiPageApiView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { GetWikiPageUpdatability, WikiPageData, wikiParseCanonicalWikiPath } from "../../wiki/shared/wikiUtils";
import { ProcessEventDescriptionForWikiPage } from "./wikiNamespaceEventDescription";

interface GetWikiPageCoreArgs {
    canonicalWikiSlug: string;
    clientBaseContentVersion: number;
    clientBaseRevisionId: WikiPageRevisionPublicId | null;
    clientLockId: string | null;
    authorization: CMServerAuthorization;
    database: DB3ReadDatabase;
};

export async function GetWikiPageCore({ canonicalWikiSlug, authorization: initialAuth, database, ...args }: GetWikiPageCoreArgs): Promise<WikiPageData> {
    return executeDB3Read(database, initialAuth, async context => {
        const authorization = requireWikiAccess(context, Permission.view_wiki_pages);

        const result = await queryView({
            view: wikiPageApiView,
            filter: {
                items: [{ field: "slug", operator: "equals", value: canonicalWikiSlug }],
            },
            orderBy: undefined,
            take: 1,
            cmdbQueryContext: "wiki/page",
        }, authorization, context);
        const page = result.items[0] ?? null;

        const path = wikiParseCanonicalWikiPath(canonicalWikiSlug);
        const lockStatus = GetWikiPageUpdatability({
            currentPage: page,
            currentUserPublicId: authorization.userPublicId,
            userClientLockId: args.clientLockId,
            baseRevisionId: args.clientBaseRevisionId,
            baseContentVersion: args.clientBaseContentVersion,
        });

        let ret: WikiPageData = {
            eventContext: null,
            wikiPage: page,// || await MakeNewWikiPage(slug),
            titleIsEditable: true,
            specialWikiNamespace: null,
            isExisting: page !== null,
            lockStatus,
        };

        // if the page is of a special namespace, the title should be calculated and uneditable.
        if (path.namespace) {
            ret = await ProcessEventDescriptionForWikiPage(
                path.namespace,
                path.slugWithoutNamespace,
                ret,
                authorization,
                context,
            );
        }

        return ret;
    });
}
