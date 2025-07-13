import { hash256 } from "@blitzjs/auth";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { ActivityReportTimeBucketSize, parseBucketToDateRange } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { hashString } from "shared/utils";
import { z } from "zod";
import { GeneralActivityReportDetailArgs, GeneralActivityReportDetailPayload } from "../activityReportTypes";
import { ActivityFeature } from "../activityTracking";

const ZTGeneralFeatureDetailArgs = z.object({
    features: z.nativeEnum(ActivityFeature).array(),
    bucket: z.string().nullable(),
    aggregateBy: z.nativeEnum(ActivityReportTimeBucketSize),
    excludeYourself: z.boolean(),
    excludeSysadmins: z.boolean(),

    contextBeginsWith: z.string().optional(),
    filteredSongId: z.number().optional(),
    filteredEventId: z.number().optional(),
    //filteredUserId: z.number().optional(),
    filteredWikiPageId: z.number().optional(),
});

type TGeneralFeatureDetailArgs = z.infer<typeof ZTGeneralFeatureDetailArgs>;

interface GeneralFeatureDetailResult {
    data: GeneralActivityReportDetailPayload[];
};

async function getActionCountsByDateRangeMySQL(params: TGeneralFeatureDetailArgs, ctx: AuthenticatedCtx): Promise<GeneralFeatureDetailResult | null> {
    if (!params.bucket) {
        return null;
    }
    const {
        features,
        filteredSongId,
        filteredEventId,
        filteredWikiPageId,
        contextBeginsWith,
    } = params;

    const dateRange = parseBucketToDateRange(params.bucket, params.aggregateBy);

    const results = await db.action.findMany({
        where: {
            ...(features.length > 0 && { feature: { in: features } }),
            createdAt: {
                gte: dateRange.start,
                lt: dateRange.end,
            },
            ...(params.excludeYourself && { userId: { not: ctx.session.userId } }),
            ...(params.excludeSysadmins && {
                user: {
                    isSysAdmin: false,
                },
            }),
            ...(filteredSongId && { songId: filteredSongId }),
            ...(filteredEventId && { eventId: filteredEventId }),
            ...(filteredWikiPageId && { wikiPageId: filteredWikiPageId }),
            ...(contextBeginsWith && { context: { startsWith: contextBeginsWith } }),
        },
        ...GeneralActivityReportDetailArgs,
        orderBy: {
            createdAt: "desc",
        },
        take: 1000,
    });

    // to anonymize users as much as possible, hash their userID with a deterministic salt
    // which is a hash of query params.

    const salt = hashString(
        `${params.bucket}_${params.aggregateBy}_${params.excludeYourself}_5e0a4383307e4eb8322397d4bce4de0375e37c1a6c76bdb39abf5143e538b01b`
    );

    const anonymizedResults = results.map((result) => {
        const anonymizedUserId = result.userId ? `${salt}${result.userId}` : null;
        const { userId, user, ...rest } = result;
        return {
            ...rest,
            userHash: anonymizedUserId ? hash256(anonymizedUserId) : null,
        };
    });

    return {
        data: anonymizedResults,
    };
}

export default resolver.pipe(
    resolver.zod(ZTGeneralFeatureDetailArgs),
    resolver.authorize(Permission.view_feature_reports),
    async (args, ctx: AuthenticatedCtx): Promise<GeneralFeatureDetailResult | null> => {
        return await getActionCountsByDateRangeMySQL(args, ctx);
    }
);
