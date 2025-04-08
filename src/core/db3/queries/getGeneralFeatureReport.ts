import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { getMySqlAggregateDateFormat, MySqlDateTimeLiteral, MySqlStringLiteral, MySqlSymbol } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { ActivityFeature } from "../shared/activityTracking";
import { ReportAggregateBy } from "../shared/apiTypes";

const ZTGeneralFeatureReportArgs = z.object({
    features: z.nativeEnum(ActivityFeature).array(),
    startDate: z.date(),
    endDate: z.date(),
    aggregateBy: z.nativeEnum(ReportAggregateBy),
    excludeYourself: z.boolean(),

    filteredSongId: z.number().optional(),
    filteredEventId: z.number().optional(),
    filteredUserId: z.number().optional(),
    filteredWikiPageId: z.number().optional(),
});

type TGeneralFeatureReportArgs = z.infer<typeof ZTGeneralFeatureReportArgs>;

interface GeneralFeatureReportResult {
    data: {
        bucket: string;
        count: number;
    }[];
};

async function getActionCountsByDateRangeMySQL(params: TGeneralFeatureReportArgs, ctx: AuthenticatedCtx): Promise<GeneralFeatureReportResult> {
    const {
        features,
        startDate,
        endDate,
        aggregateBy,
        filteredSongId,
        filteredEventId,
        filteredUserId,
        filteredWikiPageId,
    } = params;

    // Get the date format
    const dateFormat = getMySqlAggregateDateFormat(aggregateBy);

    const conditions: string[] = [];

    if (features.length > 0) {
        conditions.push(`${MySqlSymbol("feature")} IN (${features.map((feature) => MySqlStringLiteral(feature)).join(", ")})`);
    }

    conditions.push(`${MySqlSymbol("createdAt")} >= ${MySqlDateTimeLiteral(startDate)}`);
    conditions.push(`${MySqlSymbol("createdAt")} <= ${MySqlDateTimeLiteral(endDate)}`);

    if (filteredSongId) {
        conditions.push(`${MySqlSymbol("songId")} = ${filteredSongId}`);
    }
    if (filteredEventId) {
        conditions.push(`${MySqlSymbol("eventId")} = ${filteredEventId}`);
    }
    if (filteredUserId) {
        conditions.push(`${MySqlSymbol("userId")} = ${filteredUserId}`);
    }
    if (filteredWikiPageId) {
        conditions.push(`${MySqlSymbol("wikiPageId")} = ${filteredWikiPageId}`);
    }

    // exclude the current user optionally
    if (params.excludeYourself) {
        const currentUserId = ctx.session.userId;
        conditions.push(`${MySqlSymbol("userId")} != ${currentUserId}`);
    }

    // Combine conditions in a single WHERE clause
    const whereClause = conditions.length
        ? "WHERE " + conditions.join(" AND ")
        : "";

    const sqlQuery = `
      SELECT
        DATE_FORMAT(\`createdAt\`, '${dateFormat}') AS bucket,
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
        }))
    };
}





export default resolver.pipe(
    resolver.zod(ZTGeneralFeatureReportArgs),
    resolver.authorize(Permission.sysadmin),
    async (args, ctx: AuthenticatedCtx): Promise<GeneralFeatureReportResult> => {
        return await getActionCountsByDateRangeMySQL(args, ctx);
    }
);
