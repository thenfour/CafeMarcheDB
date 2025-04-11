import { hash256 } from "@blitzjs/auth";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { parseBucketToDateRange } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { hashString } from "shared/utils";
import { z } from "zod";
import { ActivityFeature } from "../shared/activityTracking";
import { GeneralActivityReportDetailArgs, GeneralActivityReportDetailPayload, ReportAggregateBy } from "../shared/apiTypes";

const ZTGeneralFeatureDetailArgs = z.object({
    features: z.nativeEnum(ActivityFeature).array(),
    excludeFeatures: z.nativeEnum(ActivityFeature).array(),
    bucket: z.string().nullable(),
    aggregateBy: z.nativeEnum(ReportAggregateBy),
    excludeYourself: z.boolean(),
    excludeSysadmins: z.boolean(),

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
        excludeFeatures,
        filteredSongId,
        filteredEventId,
        //filteredUserId,
        filteredWikiPageId,
    } = params;

    const dateRange = parseBucketToDateRange(params.bucket, params.aggregateBy);

    const results = await db.action.findMany({
        where: {
            ...(features.length > 0 && { feature: { in: features } }),
            ...(excludeFeatures.length > 0 && { feature: { notIn: excludeFeatures } }),
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
            //...(filteredUserId && { userId: filteredUserId }),
            ...(filteredWikiPageId && { wikiPageId: filteredWikiPageId }),
        },
        ...GeneralActivityReportDetailArgs,
        orderBy: {
            createdAt: "desc",
        },
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
    resolver.authorize(Permission.sysadmin),
    async (args, ctx: AuthenticatedCtx): Promise<GeneralFeatureDetailResult | null> => {
        return await getActionCountsByDateRangeMySQL(args, ctx);
    }
);
