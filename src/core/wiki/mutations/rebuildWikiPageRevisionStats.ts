import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { PrismaClient } from "db";
import { loadAuthorization } from "@/src/auth/server/serverAuthorization";
import { toSorted } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { calculateDiff } from "../shared/wikiUtils";

async function core(dbt) {

    // Intentional read-policy bypass: this is a whole-table maintenance job.
    // Hidden pages must have correct derived revision statistics too, and no
    // page content is returned to the caller.
    const pages = await (dbt as PrismaClient).wikiPage.findMany({
        include: {
            revisions: true,
        }
    });

    for (const page of pages) {
        const revisions = toSorted(page.revisions, (a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        for (let revisionIndex = 0; revisionIndex < revisions.length; revisionIndex++) {
            const rev = revisions[revisionIndex]!;
            const prevRev = revisions[revisionIndex + 1];
            const stats = calculateDiff(prevRev?.content || "", rev.content);
            await dbt.wikiPageRevision.update({
                where: { id: rev.id },
                data: {
                    lineCount: stats.newLines,
                    prevLineCount: stats.oldLines,
                    linesAdded: stats.linesAdded,
                    linesRemoved: stats.linesRemoved,

                    prevSizeChars: stats.oldSize,
                    sizeChars: stats.newSize,

                    charsAdded: stats.charsAdded,
                    charsRemoved: stats.charsRemoved,
                },
            });
        }
    };

}

export default resolver.pipe(
    resolver.authorize(Permission.admin_wiki_pages),
    resolver.zod(z.object({})),
    async (args, ctx: AuthenticatedCtx): Promise<void> => {
        await db.$transaction(async (dbt) => {
            await core(dbt as any);
        });

        // await RegisterChange({
        //     action: ChangeAction.delete,
        //     auth: await loadAuthorization(ctx.session),
        //     changeContext,
        //     pkid: -1,
        //     table: "WikiPageRevision",
        // });
    } // async fn
); // pipe

