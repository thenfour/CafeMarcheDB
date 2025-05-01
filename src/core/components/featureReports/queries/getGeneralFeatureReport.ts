import { Stopwatch } from "@/shared/rootroot";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { getMySqlTimeBucketSelectExpression, MySqlDateTimeLiteral, MySqlStringLiteral, MySqlStringLiteralAllowingPercent, MySqlSymbol } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { ZFeatureReportFilterSpec } from "../activityReportTypes";

const ZTGeneralFeatureReportArgs = z.object({
    //features: z.nativeEnum(ActivityFeature).array(),
    startDate: z.date(),
    endDate: z.date(),
    filterSpec: ZFeatureReportFilterSpec,
    //aggregateBy: z.nativeEnum(ActivityReportTimeBucketSize),
    //excludeYourself: z.boolean(),
    //excludeSysadmins: z.boolean(),

    // filteredSongId: z.number().optional(),
    // filteredEventId: z.number().optional(),
    // filteredWikiPageId: z.number().optional(),
    // contextBeginsWith: z.string().optional(),
});

type TGeneralFeatureReportArgs = z.infer<typeof ZTGeneralFeatureReportArgs>;

interface GeneralFeatureReportResult {
    data: {
        bucket: string;
        count: number;
    }[];
    metrics: {
        queryTimeMs: number;
    };
};

async function getActionCountsByDateRangeMySQL(params: TGeneralFeatureReportArgs, ctx: AuthenticatedCtx): Promise<GeneralFeatureReportResult> {
    const sw = new Stopwatch();
    const {
        filterSpec,
        startDate,
        endDate,
        // aggregateBy,
        // filteredSongId,
        // filteredEventId,
        // filteredWikiPageId,
        // contextBeginsWith,
    } = params;

    const conditions: string[] = [];

    if (filterSpec.includeFeatures.length > 0) {
        conditions.push(`${MySqlSymbol("feature")} IN (${filterSpec.includeFeatures.map((feature) => MySqlStringLiteral(feature)).join(", ")})`);
    }

    // if (params.excludeFeatures.length > 0) {
    //     conditions.push(`${MySqlSymbol("feature")} NOT IN (${params.excludeFeatures.map((feature) => MySqlStringLiteral(feature)).join(", ")})`);
    // }

    conditions.push(`${MySqlSymbol("createdAt")} >= ${MySqlDateTimeLiteral(startDate)}`);
    conditions.push(`${MySqlSymbol("createdAt")} <= ${MySqlDateTimeLiteral(endDate)}`);

    // if (filteredSongId) {
    //     conditions.push(`${MySqlSymbol("songId")} = ${filteredSongId}`);
    // }
    // if (filteredEventId) {
    //     conditions.push(`${MySqlSymbol("eventId")} = ${filteredEventId}`);
    // }
    // if (filteredUserId) {
    //     conditions.push(`${MySqlSymbol("userId")} = ${filteredUserId}`);
    // }
    // if (filteredWikiPageId) {
    //     conditions.push(`${MySqlSymbol("wikiPageId")} = ${filteredWikiPageId}`);
    // }

    if (filterSpec.contextBeginsWith) {
        conditions.push(`${MySqlSymbol("context")} LIKE ${MySqlStringLiteralAllowingPercent(filterSpec.contextBeginsWith + "%")}`);
    }

    // exclude the current user optionally
    if (filterSpec.excludeYourself) {
        const currentUserId = ctx.session.userId;
        conditions.push(`${MySqlSymbol("userId")} != ${currentUserId}`);
    }

    if (filterSpec.excludeSysadmins) {
        conditions.push(`${MySqlSymbol("userId")} NOT IN (SELECT ${MySqlSymbol("id")} FROM \`User\` WHERE ${MySqlSymbol("isSysAdmin")} = 1)`);
    }

    // Combine conditions in a single WHERE clause
    const whereClause = conditions.length
        ? "WHERE " + conditions.join(" AND ")
        : "";

    //const dateFormat = getMySqlAggregateDateFormat(aggregateBy);

    const sqlQuery = `
      SELECT
        ${getMySqlTimeBucketSelectExpression(`createdAt`, filterSpec.bucketSize)} AS bucket,
        COUNT(*) AS count
      FROM \`Action\`
      ${whereClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    // Execute the raw query with placeholders
    const results = await db.$queryRaw<{ bucket: string; count: bigint }[]>(Prisma.raw(sqlQuery));

    return {
        data: results.map((row) => ({
            bucket: row.bucket,    // or parse as Date if you prefer
            count: Number(row.count),
        })),
        metrics: {
            queryTimeMs: sw.ElapsedMillis,
        },
    };
}





export default resolver.pipe(
    resolver.zod(ZTGeneralFeatureReportArgs),
    resolver.authorize(Permission.sysadmin),
    async (args, ctx: AuthenticatedCtx): Promise<GeneralFeatureReportResult> => {
        return await getActionCountsByDateRangeMySQL(args, ctx);
    }
);
