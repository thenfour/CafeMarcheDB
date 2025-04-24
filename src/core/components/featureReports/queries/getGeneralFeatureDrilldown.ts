// import { hash256 } from "@blitzjs/auth";
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db from "db";
// import { parseBucketToDateRange } from "shared/mysqlUtils";
// import { Permission } from "shared/permissions";
// import { hashString } from "shared/utils";
// import { z } from "zod";
// import { ActivityFeature } from "../../components/featureReports/activityTracking";
// import { GeneralActivityReportDetailArgs, GeneralActivityReportDetailPayload, ReportAggregateBy } from "../shared/apiTypes";
// import { ActivityDetailTabId } from "../../components/featureReports/activityReportTypes";

// interface Facet {
//     getCounts: () => Promise<{}>;
// };

// async function getFeatureAggData(params: TFeatureAggregateReportArgs, ctx: AuthenticatedCtx): Promise<{}> {
//     // if (!params.bucket) {
//     //     return {};
//     // }
//     // const {
//     //     features,
//     //     excludeFeatures,
//     //     filteredSongId,
//     //     filteredEventId,
//     //     filteredWikiPageId,
//     //     contextBeginsWith,
//     // } = params;

//     const dateRange = parseBucketToDateRange(params.bucket, params.aggregateBy);

//     // form aggregations

//     // for each supported grouping, run a separate query to get distinct items

//     const facets: Record<ActivityDetailTabId, Facet> = {
//         [ActivityDetailTabId.feature]: {
//             getCounts: async () => {

//             },
//         };

//         // const results = await db.action.findMany({
//         //     where: {
//         //         ...(features.length > 0 && { feature: { in: features } }),
//         //         ...(excludeFeatures.length > 0 && { feature: { notIn: excludeFeatures } }),
//         //         createdAt: {
//         //             gte: dateRange.start,
//         //             lt: dateRange.end,
//         //         },
//         //         ...(params.excludeYourself && { userId: { not: ctx.session.userId } }),
//         //         ...(params.excludeSysadmins && {
//         //             user: {
//         //                 isSysAdmin: false,
//         //             },
//         //         }),
//         //         ...(filteredSongId && { songId: filteredSongId }),
//         //         ...(filteredEventId && { eventId: filteredEventId }),
//         //         ...(filteredWikiPageId && { wikiPageId: filteredWikiPageId }),
//         //         ...(contextBeginsWith && { context: { startsWith: contextBeginsWith } }),
//         //     },
//         //     ...GeneralActivityReportDetailArgs,
//         //     orderBy: {
//         //         createdAt: "desc",
//         //     },
//         //     take: 1000,
//         // });

//         // to anonymize users as much as possible, hash their userID with a deterministic salt
//         // which is a hash of query params.

//         // const salt = hashString(
//         //     `${params.bucket}_${params.aggregateBy}_${params.excludeYourself}_5e0a4383307e4eb8322397d4bce4de0375e37c1a6c76bdb39abf5143e538b01b`
//         // );

//         // const anonymizedResults = results.map((result) => {
//         //     const anonymizedUserId = result.userId ? `${salt}${result.userId}` : null;
//         //     const { userId, user, ...rest } = result;
//         //     return {
//         //         ...rest,
//         //         userHash: anonymizedUserId ? hash256(anonymizedUserId) : null,
//         //     };
//         // });

//         return {
//             //data: anonymizedResults,
//         };
//     }

//     export default resolver.pipe(
//         resolver.zod(ZTFeatureAggregateReportArgs),
//         resolver.authorize(Permission.sysadmin),
//         async (args, ctx: AuthenticatedCtx): Promise<{}> => {
//             return await getFeatureAggData(args, ctx);
//         }
//     );
