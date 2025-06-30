// based off the structure/logic of getEventFilterInfo

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetUserVisibilityWhereExpression } from "src/core/db3/shared/db3Helpers";
import { TGetWikiPageRevisionsArgs, ZTGetWikiPageRevisionsArgs } from "../shared/wikiUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_page_revisions),
    resolver.zod(ZTGetWikiPageRevisionsArgs),
    async (args: TGetWikiPageRevisionsArgs, ctx: AuthenticatedCtx) => {
        const currentUser = (await getCurrentUserCore(ctx))!;
        const visibilityPermission = GetUserVisibilityWhereExpression({
            id: currentUser.id,
            roleId: currentUser.roleId,
        });

        const page = await db.wikiPage.findUnique({
            where: {
                slug: args.canonicalWikiPath,
                ...visibilityPermission,
            },
            include: {
                revisions: true,
                currentRevision: true,
            }
        });

        return page;
    }
);



