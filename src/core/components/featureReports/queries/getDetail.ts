// returns a row-by-row detail of data,

import { Stopwatch } from "@/shared/rootroot";
import { getCurrentUserCore } from "@/src/core/db3/server/db3mutationCore";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { GetFeatureReportDetailResultArgs, TGetFeatureReportDetailResult, ZFeatureReportFilterSpec } from "../activityReportTypes";
import { buildFeatureReportFiltersSQL, GetAnonymizedUserHash } from "../server/facetProcessor";

const ZTArgs = z.object({
    refreshTrigger: z.number(),
    filterSpec: ZFeatureReportFilterSpec,
});

type TArgs = z.infer<typeof ZTArgs>;

async function getFilteredDetails(args: TArgs, ctx: AuthenticatedCtx): Promise<TGetFeatureReportDetailResult | null> {
    if (!args.filterSpec.selectedBucket) {
        return null;
    }
    const currentUser = await getCurrentUserCore(ctx);
    if (!currentUser) {
        return null;
    }

    const filterSql = buildFeatureReportFiltersSQL(args.filterSpec, currentUser);

    const sw = new Stopwatch();

    // Get total count without limit
    const totalCountResult = await db.$queryRaw(Prisma.raw(`SELECT COUNT(*) as count FROM Action WHERE ${filterSql}`)) as { count: bigint }[];
    const totalRowCount = Number(totalCountResult[0]?.count || 0);

    // Use higher limit for exports
    const limit = 200;
    const ids = await db.$queryRaw(Prisma.raw(`SELECT id FROM Action WHERE ${filterSql} ORDER BY createdAt DESC LIMIT ${limit}`)) as { id: number }[];

    const result = await db.action.findMany({
        where: {
            id: { in: ids.map((row) => row.id) },
        },
        ...GetFeatureReportDetailResultArgs,
    });

    return {
        rows: result.map((row) => {
            return {
                ...row,
                userHash: GetAnonymizedUserHash(row.userId, filterSql),
            };
        }),
        metrics: {
            queryTimeMs: sw.ElapsedMillis,
            totalRowCount,
        },
    };
}

export default resolver.pipe(
    resolver.zod(ZTArgs),
    resolver.authorize(Permission.view_feature_reports),
    async (args, ctx: AuthenticatedCtx): Promise<TGetFeatureReportDetailResult | null> => {
        return await getFilteredDetails(args, ctx);
    }
);
