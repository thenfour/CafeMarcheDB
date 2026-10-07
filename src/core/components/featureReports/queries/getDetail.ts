import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

// Reject every legacy report input before loading authorization data or report rows.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("activityReports"),
);

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/queries/getDetail.ts:1-68
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: 98273220a4b1aa60e8d54f3a9e2be0bbb2ea267330d1be4b6f03d3887f9a7353
// MIGRATION_REFERENCE_BEGIN
// // returns a row-by-row detail of data,
//
// import { Stopwatch } from "@/shared/rootroot";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { z } from "zod";
// import { GetFeatureReportDetailResultArgs, projectFeatureReportDetailItem, TGetFeatureReportDetailResult, ZFeatureReportFilterSpec } from "../activityReportTypes";
// import { buildFeatureReportFiltersSQL, GetAnonymizedUserHash } from "../server/facetProcessor";
//
// const ZTArgs = z.object({
//     refreshTrigger: z.number(),
//     filterSpec: ZFeatureReportFilterSpec,
// });
//
// type TArgs = z.infer<typeof ZTArgs>;
//
// async function getFilteredDetails(args: TArgs, ctx: AuthenticatedCtx): Promise<TGetFeatureReportDetailResult | null> {
//     if (!args.filterSpec.selectedBucket) {
//         return null;
//     }
//     const currentUser = (await loadAuthorization(ctx.session)).user;
//     if (!currentUser) {
//         return null;
//     }
//
//     const filterSql = buildFeatureReportFiltersSQL(args.filterSpec, currentUser);
//
//     const sw = new Stopwatch();
//
//     // Get total count without limit
//     const totalCountResult = await db.$queryRaw(Prisma.raw(`SELECT COUNT(*) as count FROM Action WHERE ${filterSql}`)) as { count: bigint }[];
//     const totalRowCount = Number(totalCountResult[0]?.count || 0);
//
//     // Use higher limit for exports
//     const limit = 200;
//     const ids = await db.$queryRaw(Prisma.raw(`SELECT id FROM Action WHERE ${filterSql} ORDER BY createdAt DESC LIMIT ${limit}`)) as { id: number }[];
//
//     const result = await db.action.findMany({
//         where: {
//             id: { in: ids.map((row) => row.id) },
//         },
//         ...GetFeatureReportDetailResultArgs,
//     });
//
//     return {
//         rows: result.map((row) => {
//             return {
//                 ...projectFeatureReportDetailItem(row),
//                 userHash: GetAnonymizedUserHash(row.userId, filterSql),
//             };
//         }),
//         metrics: {
//             queryTimeMs: sw.ElapsedMillis,
//             totalRowCount,
//         },
//     };
// }
//
// export default resolver.pipe(
//     resolver.zod(ZTArgs),
//     resolver.authorize(Permission.view_feature_reports),
//     async (args, ctx: AuthenticatedCtx): Promise<TGetFeatureReportDetailResult | null> => {
//         return await getFilteredDetails(args, ctx);
//     }
// );
// MIGRATION_REFERENCE_END
