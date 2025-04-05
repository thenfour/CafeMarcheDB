// returns a specific revision ID

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "src/core/db3/server/db3mutationCore";
import { GetUserVisibilityWhereExpression } from "src/core/db3/shared/db3Helpers";
import { TGetWikiPageRevisionArgs, ZTGetWikiPageRevisionArgs } from "src/core/wiki/shared/wikiUtils";

export default resolver.pipe(
    resolver.authorize(Permission.view_wiki_pages),
    resolver.zod(ZTGetWikiPageRevisionArgs),
    async (args: TGetWikiPageRevisionArgs, ctx: AuthenticatedCtx) => {
        if (!args.revisionId) {
            return null;
        }
        const currentUser = (await getCurrentUserCore(ctx))!;
        const visibilityPermission = GetUserVisibilityWhereExpression({
            id: currentUser.id,
            roleId: currentUser.roleId,
        });

        const page = await db.wikiPageRevision.findUnique({
            where: {
                id: args.revisionId,
                ...visibilityPermission,
            },
            include: {
                wikiPage: true,
            }
        });

        return page;
    }
);



