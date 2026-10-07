import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

// Reject every legacy report input before loading authorization data or report rows.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("activityReports"),
);

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/queries/getFacetedBreakdown.ts:1-64
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: f05fbbe5d1b93b7f8e73accb80b89058ebb4bebccffd01abfb9188eed7d3830e
// MIGRATION_REFERENCE_BEGIN
// import { Stopwatch, TAnyModel } from "@/shared/rootroot";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { z } from "zod";
// import { FacetedBreakdownResult, ZFeatureReportFilterSpec } from "../activityReportTypes";
// import { buildFeatureReportFiltersSQL, FacetProcessor, gFeatureReportFacetProcessors, TotalFacetProcessor } from "../server/facetProcessor";
//
// const ZTArgs = z.object({
//   refreshTrigger: z.number(),
//   filterSpec: ZFeatureReportFilterSpec,
// });
//
// type TArgs = z.infer<typeof ZTArgs>;
//
// async function getFeatureReportFacetsAndCountsForSet(args: TArgs, ctx: AuthenticatedCtx): Promise<FacetedBreakdownResult | null> {
//   if (!args.filterSpec.selectedBucket) {
//     return null;
//   }
//   const auth = await loadAuthorization(ctx.session);
//   const currentUser = auth.user;
//   if (!currentUser) {
//     return null;
//   }
//
//   const filterSql = buildFeatureReportFiltersSQL(args.filterSpec, currentUser);
//
//   const sw = new Stopwatch();
//
//   const doProcessor = async <T,>(facetKey: string, processor: FacetProcessor<T>) => {
//     const query = processor.getGroupedQuery(filterSql, auth);
//     const rawRows = await db.$queryRaw(Prisma.raw(query)) as TAnyModel[];
//     const processedRows = rawRows.map((row) => processor.postProcessRow(row, filterSql, currentUser)).filter((row) => row !== null);
//     return processedRows;
//   };
//
//   const facetResults = await Promise.all(
//     Object.entries(gFeatureReportFacetProcessors).map(async ([facetKey, processor]) => {
//       return [facetKey, await doProcessor(facetKey, processor)];
//     })
//   );
//
//   const totals = await doProcessor("total", TotalFacetProcessor);
//
//   const ret: FacetedBreakdownResult = {
//     metrics: {
//       queryTimeMs: sw.ElapsedMillis,
//     },
//     total: totals[0]!,
//     facets: Object.fromEntries(facetResults) as FacetedBreakdownResult['facets'],
//   };
//
//   return ret;
// }
//
// export default resolver.pipe(
//   resolver.zod(ZTArgs),
//   resolver.authorize(Permission.view_feature_reports),
//   async (args, ctx: AuthenticatedCtx): Promise<FacetedBreakdownResult | null> => {
//     return await getFeatureReportFacetsAndCountsForSet(args, ctx);
//   }
// );
// MIGRATION_REFERENCE_END
