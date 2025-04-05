import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { z } from "zod";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.admin_wiki_pages),
    resolver.zod(z.object({ revisionId: z.number() })),
    async (args, ctx: AuthenticatedCtx): Promise<void> => {
        //const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
        const changeContext = CreateChangeContext("updateWikiPage");
        await db.wikiPageRevision.delete({
            where: { id: args.revisionId }
        });
        RegisterChange({
            action: ChangeAction.delete,
            ctx,
            changeContext,
            pkid: args.revisionId,
            table: "WikiPageRevision",
        });
    }
);

