import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "src/core/db3/db3";
import { loadAuthorization } from "src/auth/server/requestAuthorization";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.admin_wiki_pages),
    resolver.zod(z.object({ revisionId: db3.xWikiPageRevision.identitySchema })),
    async (args, ctx: AuthenticatedCtx): Promise<void> => {
        const authorization = await loadAuthorization(ctx.session);
        const revision = await db.wikiPageRevision.findFirst({
            where: {
                publicId: args.revisionId,
                wikiPage: db3.xWikiPage.CalculateWhereClause({
                    filterModel: { tableParams: {} },
                    publicData: authorization,
                    includeDeleted: false,
                }),
            },
            select: { id: true },
        });
        if (!revision) throw new Error("Wiki page revision was not found.");
        const changeContext = CreateChangeContext("updateWikiPage");
        await db.wikiPageRevision.delete({
            where: { id: revision.id }
        });
        await RegisterChange({
            action: ChangeAction.delete,
            ctx,
            changeContext,
            pkid: revision.id,
            table: "WikiPageRevision",
        });
    }
);

