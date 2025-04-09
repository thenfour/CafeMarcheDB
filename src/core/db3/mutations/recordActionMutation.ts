// insertOrUpdateWorkflowDefMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import * as mutationCore from "../server/db3mutationCore";
import { ZTRecordActionArgs } from "../server/recordActionServer";

export default resolver.pipe(
    resolver.zod(ZTRecordActionArgs),
    async (args, ctx: AuthenticatedCtx) => {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);

        await db.action.create({
            data: {
                userId: currentUser?.id,
                isClient: true,
                uri: args.uri,
                feature: args.feature,

                eventId: args.eventId,
                fileId: args.fileId,
                songId: args.songId,
                wikiPageId: args.wikiPageId,
                context: args.context,
                queryText: args.queryText,
            },
        });

    }
);

