import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

// Reject every legacy report input before loading authorization data or report rows.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("activityReports"),
);

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/queries/getGeneralFeatureReport.ts:1-133
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: de68e18b4a3bbd9bc1e4b2623fe76d258587e9293d520e561613fa4a041c5fbe
// MIGRATION_REFERENCE_BEGIN
// // this is specifically for the feature reports
//
// import { Stopwatch } from "@/shared/rootroot";
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db, { Prisma } from "db";
// import { getMySqlTimeBucketSelectExpression, MySqlDateTimeLiteral, MySqlStringLiteral, MySqlStringLiteralAllowingPercent, MySqlSymbol } from "shared/mysqlUtils";
// import { Permission } from "shared/permissions";
// import { z } from "zod";
// import { ZFeatureReportFilterSpec } from "../activityReportTypes";
//
// const ZTGeneralFeatureReportArgs = z.object({
//     //features: z.nativeEnum(ActivityFeature).array(),
//     startDate: z.date(),
//     endDate: z.date(),
//     filterSpec: ZFeatureReportFilterSpec,
//     //aggregateBy: z.nativeEnum(ActivityReportTimeBucketSize),
//     //excludeYourself: z.boolean(),
//     //excludeSysadmins: z.boolean(),
//
//     // filteredSongId: z.number().optional(),
//     // filteredEventId: z.number().optional(),
//     // filteredWikiPageId: z.number().optional(),
//     // contextBeginsWith: z.string().optional(),
// });
//
// type TGeneralFeatureReportArgs = z.infer<typeof ZTGeneralFeatureReportArgs>;
//
// interface GeneralFeatureReportResult {
//     data: {
//         bucket: string;
//         count: number;
//     }[];
//     metrics: {
//         queryTimeMs: number;
//     };
// };
//
// async function getActionCountsByDateRangeMySQL(params: TGeneralFeatureReportArgs, ctx: AuthenticatedCtx): Promise<GeneralFeatureReportResult> {
//     const sw = new Stopwatch();
//     const {
//         filterSpec,
//         startDate,
//         endDate,
//         // aggregateBy,
//         // filteredSongId,
//         // filteredEventId,
//         // filteredWikiPageId,
//         // contextBeginsWith,
//     } = params;
//
//     const conditions: string[] = [];
//
//     if (filterSpec.includeFeatures.length > 0) {
//         conditions.push(`${MySqlSymbol("feature")} IN (${filterSpec.includeFeatures.map((feature) => MySqlStringLiteral(feature)).join(", ")})`);
//     }
//
//     // if (params.excludeFeatures.length > 0) {
//     //     conditions.push(`${MySqlSymbol("feature")} NOT IN (${params.excludeFeatures.map((feature) => MySqlStringLiteral(feature)).join(", ")})`);
//     // }
//
//     conditions.push(`${MySqlSymbol("createdAt")} >= ${MySqlDateTimeLiteral(startDate)}`);
//     conditions.push(`${MySqlSymbol("createdAt")} <= ${MySqlDateTimeLiteral(endDate)}`);
//
//     // if (filteredSongId) {
//     //     conditions.push(`${MySqlSymbol("songId")} = ${filteredSongId}`);
//     // }
//     // if (filteredEventId) {
//     //     conditions.push(`${MySqlSymbol("eventId")} = ${filteredEventId}`);
//     // }
//     // if (filteredUserId) {
//     //     conditions.push(`${MySqlSymbol("userId")} = ${filteredUserId}`);
//     // }
//     // if (filteredWikiPageId) {
//     //     conditions.push(`${MySqlSymbol("wikiPageId")} = ${filteredWikiPageId}`);
//     // }
//
//     if (filterSpec.contextBeginsWith) {
//         conditions.push(`${MySqlSymbol("context")} LIKE ${MySqlStringLiteralAllowingPercent(filterSpec.contextBeginsWith + "%")}`);
//     }
//
//     // exclude the current user optionally
//     if (filterSpec.excludeYourself) {
//         const currentUserId = ctx.session.userId;
//         conditions.push(`${MySqlSymbol("userId")} != ${currentUserId}`);
//     }
//
//     if (filterSpec.excludeSysadmins) {
//         conditions.push(`${MySqlSymbol("userId")} NOT IN (SELECT ${MySqlSymbol("id")} FROM \`User\` WHERE ${MySqlSymbol("isSysAdmin")} = 1)`);
//     }
//
//     // Combine conditions in a single WHERE clause
//     const whereClause = conditions.length
//         ? "WHERE " + conditions.join(" AND ")
//         : "";
//
//     //const dateFormat = getMySqlAggregateDateFormat(aggregateBy);
//
//     const sqlQuery = `
//       SELECT
//         ${getMySqlTimeBucketSelectExpression(`createdAt`, filterSpec.bucketSize)} AS bucket,
//         COUNT(*) AS count
//       FROM \`Action\`
//       ${whereClause}
//       GROUP BY bucket
//       ORDER BY bucket ASC
//     `;
//
//     // Execute the raw query with placeholders
//     const results = await db.$queryRaw<{ bucket: string; count: bigint }[]>(Prisma.raw(sqlQuery));
//
//     return {
//         data: results.map((row) => ({
//             bucket: row.bucket,    // or parse as Date if you prefer
//             count: Number(row.count),
//         })),
//         metrics: {
//             queryTimeMs: sw.ElapsedMillis,
//         },
//     };
// }
//
//
//
//
//
// export default resolver.pipe(
//     resolver.zod(ZTGeneralFeatureReportArgs),
//     resolver.authorize(Permission.view_feature_reports),
//     async (args, ctx: AuthenticatedCtx): Promise<GeneralFeatureReportResult> => {
//         return await getActionCountsByDateRangeMySQL(args, ctx);
//     }
// );
// MIGRATION_REFERENCE_END
