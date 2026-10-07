import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

// Reject every legacy report input before loading authorization data or report rows.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("activityReports"),
);

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/queries/getGeneralFeatureDetail.ts:1-102
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: 92c6beff96cd61d1f491787c1aa381aba4ef4ec771b2bf7e36e919dea8c4aa3c
// MIGRATION_REFERENCE_BEGIN
// import { hash256 } from "@blitzjs/auth";
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db from "db";
// import { ActivityReportTimeBucketSize, parseBucketToDateRange } from "shared/mysqlUtils";
// import { Permission } from "shared/permissions";
// import { hashString } from "shared/utils";
// import { z } from "zod";
// import {
//     GeneralActivityReportDetailArgs,
//     GeneralActivityReportDetailPayload,
//     projectGeneralActivityReportDetailItem,
// } from "../activityReportTypes";
// import { ActivityFeature } from "../activityTracking";
// import * as db3 from "@/src/core/db3/db3";
//
// const ZTGeneralFeatureDetailArgs = z.object({
//     features: z.nativeEnum(ActivityFeature).array(),
//     bucket: z.string().nullable(),
//     aggregateBy: z.nativeEnum(ActivityReportTimeBucketSize),
//     excludeYourself: z.boolean(),
//     excludeSysadmins: z.boolean(),
//
//     contextBeginsWith: z.string().optional(),
//     filteredSongId: db3.xSong.identitySchema.optional(),
//     filteredEventId: z.number().optional(), // todo: db3.xEvent.identitySchema
//     //filteredUserId: z.number().optional(), // todo: db3.xUser.identitySchema
//     filteredWikiPageId: db3.xWikiPage.identitySchema.optional(),
// });
//
// type TGeneralFeatureDetailArgs = z.infer<typeof ZTGeneralFeatureDetailArgs>;
//
// interface GeneralFeatureDetailResult {
//     data: GeneralActivityReportDetailPayload[];
// };
//
// async function getActionCountsByDateRangeMySQL(params: TGeneralFeatureDetailArgs, ctx: AuthenticatedCtx): Promise<GeneralFeatureDetailResult | null> {
//     if (!params.bucket) {
//         return null;
//     }
//     const {
//         features,
//         filteredSongId,
//         filteredEventId,
//         filteredWikiPageId,
//         contextBeginsWith,
//     } = params;
//
//     const dateRange = parseBucketToDateRange(params.bucket, params.aggregateBy);
//
//     const results = await db.action.findMany({
//         where: {
//             ...(features.length > 0 && { feature: { in: features } }),
//             createdAt: {
//                 gte: dateRange.start,
//                 lt: dateRange.end,
//             },
//             ...(params.excludeYourself && { userId: { not: ctx.session.userId } }),
//             ...(params.excludeSysadmins && {
//                 user: {
//                     isSysAdmin: false,
//                 },
//             }),
//             ...(filteredSongId && { song: { publicId: filteredSongId } }),
//             ...(filteredEventId && { eventId: filteredEventId }),
//             ...(filteredWikiPageId && { wikiPage: { publicId: filteredWikiPageId } }),
//             ...(contextBeginsWith && { context: { startsWith: contextBeginsWith } }),
//         },
//         ...GeneralActivityReportDetailArgs,
//         orderBy: {
//             createdAt: "desc",
//         },
//         take: 1000,
//     });
//
//     // to anonymize users as much as possible, hash their userID with a deterministic salt
//     // which is a hash of query params.
//
//     const salt = hashString(
//         `${params.bucket}_${params.aggregateBy}_${params.excludeYourself}_5e0a4383307e4eb8322397d4bce4de0375e37c1a6c76bdb39abf5143e538b01b`
//     );
//
//     const anonymizedResults = results.map((result) => {
//         const anonymizedUserId = result.userId ? `${salt}${result.userId}` : null;
//         return projectGeneralActivityReportDetailItem(
//             result,
//             anonymizedUserId ? hash256(anonymizedUserId) : null,
//         );
//     });
//
//     return {
//         data: anonymizedResults,
//     };
// }
//
// export default resolver.pipe(
//     resolver.zod(ZTGeneralFeatureDetailArgs),
//     resolver.authorize(Permission.view_feature_reports),
//     async (args, ctx: AuthenticatedCtx): Promise<GeneralFeatureDetailResult | null> => {
//         return await getActionCountsByDateRangeMySQL(args, ctx);
//     }
// );
// MIGRATION_REFERENCE_END
