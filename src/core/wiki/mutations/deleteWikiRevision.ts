import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "src/core/db3/db3";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { deleteImpl } from "src/core/db3/server/db3mutationCore";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { wikiPageRevisionDeleteTargetView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { wikiTransaction } from "src/core/wiki/server/wikiTransaction";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.admin_wiki_pages),
    resolver.zod(z.object({ revisionId: db3.xWikiPageRevision.identitySchema })),
    async (args, ctx: AuthenticatedCtx): Promise<void> => {
        const authorization = await loadAuthorization(ctx.session);
        await wikiTransaction(async tx => {
            const target = await queryView({
                view: wikiPageRevisionDeleteTargetView,
                filter: { publicIds: [args.revisionId] },
                orderBy: undefined,
                take: 1,
                cmdbQueryContext: "wiki/revision-delete",
            }, authorization, tx);
            if (!target.items.length) throw new Error("Wiki page revision was not found.");

            // The scoped view authorized this public ID in the same transaction.
            const revision = await tx.wikiPageRevision.findUnique({
                where: { publicId: args.revisionId },
                select: { id: true, wikiPage: { select: { currentRevisionId: true } } },
            });
            if (!revision?.wikiPage) throw new Error("Wiki page revision was not found.");
            if (revision.wikiPage.currentRevisionId === revision.id) {
                throw new Error("The current wiki page revision cannot be deleted.");
            }

            await deleteImpl(db3.xWikiPageRevision, revision.id, authorization, "hard", tx);
        });
    }
);

