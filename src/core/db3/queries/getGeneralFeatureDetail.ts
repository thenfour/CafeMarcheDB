import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { parseBucketToDateRange } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { ActivityFeature } from "../shared/activityTracking";
import { GeneralActivityReportDetailArgs, GeneralActivityReportDetailPayload, ReportAggregateBy } from "../shared/apiTypes";

const ZTGeneralFeatureDetailArgs = z.object({
    features: z.nativeEnum(ActivityFeature).array(),
    bucket: z.string().nullable(),
    aggregateBy: z.nativeEnum(ReportAggregateBy),

    filteredSongId: z.number().optional(),
    filteredEventId: z.number().optional(),
    filteredUserId: z.number().optional(),
    filteredWikiPageId: z.number().optional(),
});

type TGeneralFeatureDetailArgs = z.infer<typeof ZTGeneralFeatureDetailArgs>;

interface GeneralFeatureDetailResult {
    data: GeneralActivityReportDetailPayload[];
};

async function getActionCountsByDateRangeMySQL(params: TGeneralFeatureDetailArgs): Promise<GeneralFeatureDetailResult | null> {
    if (!params.bucket) {
        return null;
    }
    const {
        features,
        filteredSongId,
        filteredEventId,
        filteredUserId,
        filteredWikiPageId,
    } = params;

    const dateRange = parseBucketToDateRange(params.bucket, params.aggregateBy);

    const results = await db.action.findMany({
        where: {
            ...(features.length > 0 && { feature: { in: features } }),
            createdAt: {
                gte: dateRange.start,
                lt: dateRange.end,
            },
            ...(filteredSongId && { songId: filteredSongId }),
            ...(filteredEventId && { eventId: filteredEventId }),
            ...(filteredUserId && { userId: filteredUserId }),
            ...(filteredWikiPageId && { wikiPageId: filteredWikiPageId }),
        },
        ...GeneralActivityReportDetailArgs,
        orderBy: {
            createdAt: "desc",
        },
    });
    return {
        data: results
    };
}

export default resolver.pipe(
    resolver.zod(ZTGeneralFeatureDetailArgs),
    resolver.authorize(Permission.sysadmin),
    async (args, ctx: AuthenticatedCtx): Promise<GeneralFeatureDetailResult | null> => {
        return await getActionCountsByDateRangeMySQL(args);
    }
);
