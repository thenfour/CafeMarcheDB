// CSV export for activity detail data

import { Stopwatch } from "@/shared/rootroot";
import { getCurrentUserCore } from "@/src/core/db3/server/db3mutationCore";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { arrayToCSV } from "shared/utils";
import { z } from "zod";
import { GetFeatureReportDetailResultArgs, ZFeatureReportFilterSpec } from "../activityReportTypes";
import { buildFeatureReportFiltersSQL, GetAnonymizedUserHash, gFeatureReportFacetProcessors } from "../server/facetProcessor";

const ZTArgs = z.object({
    refreshTrigger: z.number(),
    filterSpec: ZFeatureReportFilterSpec,
});

type TArgs = z.infer<typeof ZTArgs>;

type CsvExportResult = {
    csvContent: string;
    filename: string;
    rowCount: number;
    metrics: {
        queryTimeMs: number;
        totalRowCount: number;
    };
};

// Flatten a complex activity record into CSV-friendly columns using facet processors
function flattenActivityRecord(row: any): Record<string, string> {
    const flattened: Record<string, string> = {};

    // Core fields (not handled by facet processors)
    flattened.id = row.id?.toString() || '';
    flattened.createdAt = row.createdAt?.toISOString() || '';
    flattened.feature = row.feature || '';
    flattened.isClient = row.isClient ? 'true' : 'false';
    flattened.userHash = row.userHash || '';
    flattened.uri = row.uri || '';
    flattened.context = row.context || '';
    flattened.queryText = row.queryText || '';
    flattened.language = row.language || '';
    flattened.locale = row.locale || '';
    flattened.timezone = row.timezone || '';
    flattened.screenWidth = row.screenWidth?.toString() || '';
    flattened.screenHeight = row.screenHeight?.toString() || '';

    // Use facet processors to handle their specific data
    Object.entries(gFeatureReportFacetProcessors).forEach(([key, processor]) => {
        if (processor.toCsvColumns) {
            try {
                // Create a mock item for the processor based on the row data
                let mockItem: any = null;

                // Map the processors to their data
                switch (key) {
                    case 'browsers':
                        if (row.browserName) {
                            mockItem = { browserName: row.browserName };
                        }
                        break;
                    case 'operatingSystems':
                        if (row.operatingSystem) {
                            mockItem = { operatingSystem: row.operatingSystem };
                        }
                        break;
                    case 'deviceClasses':
                        if (row.deviceClass) {
                            mockItem = { deviceClass: row.deviceClass };
                        }
                        break;
                    case 'pointerTypes':
                        if (row.pointerType) {
                            mockItem = { pointerType: row.pointerType };
                        }
                        break;
                    case 'songs':
                        if (row.song) {
                            mockItem = { songId: row.song.id, name: row.song.name };
                        }
                        break;
                    case 'events':
                        if (row.event) {
                            mockItem = {
                                eventId: row.event.id,
                                name: row.event.name,
                                startsAt: row.event.startsAt,
                                statusId: row.event.statusId,
                                typeId: row.event.typeId
                            };
                        }
                        break;
                }

                if (mockItem) {
                    const processorColumns = processor.toCsvColumns(mockItem);
                    Object.entries(processorColumns).forEach(([colKey, colValue]) => {
                        flattened[colKey] = String(colValue || '');
                    });
                }
            } catch (error) {
                console.warn(`Error processing CSV columns for ${key}:`, error);
            }
        }
    });

    // Handle remaining fields not covered by processors
    if (row.file) {
        flattened.fileId = row.file.id?.toString() || '';
        flattened.fileName = row.file.fileLeafName || '';
        flattened.fileStoredName = row.file.storedLeafName || '';
        flattened.fileExternalURI = row.file.externalURI || '';
    }

    if (row.wikiPage) {
        flattened.wikiPageId = row.wikiPage.id?.toString() || '';
        flattened.wikiPageSlug = row.wikiPage.slug || '';
    }

    // Other related IDs
    flattened.userId = row.userId?.toString() || '';
    flattened.attendanceId = row.attendanceId?.toString() || '';
    flattened.instrumentId = row.instrumentId?.toString() || '';
    flattened.eventSegmentId = row.eventSegmentId?.toString() || '';
    flattened.customLinkId = row.customLinkId?.toString() || '';
    flattened.eventSongListId = row.eventSongListId?.toString() || '';
    flattened.frontpageGalleryItemId = row.frontpageGalleryItemId?.toString() || '';
    flattened.menuLinkId = row.menuLinkId?.toString() || '';
    flattened.setlistPlanId = row.setlistPlanId?.toString() || '';
    flattened.songCreditTypeId = row.songCreditTypeId?.toString() || '';

    return flattened;
}

function generateFilename(filterSpec: any): string {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const bucket = filterSpec.selectedBucket || 'all-time';
    return `activity-export-${bucket}-${timestamp}.csv`;
}

async function getCsvExport(args: TArgs, ctx: AuthenticatedCtx): Promise<CsvExportResult | null> {
    if (!args.filterSpec.selectedBucket) {
        return null;
    }
    const currentUser = await getCurrentUserCore(ctx);
    if (!currentUser) {
        return null;
    }

    const filterSql = buildFeatureReportFiltersSQL(args.filterSpec, currentUser);
    const sw = new Stopwatch();

    // Get total count without limit
    const totalCountResult = await db.$queryRaw(Prisma.raw(`SELECT COUNT(*) as count FROM Action WHERE ${filterSql}`)) as { count: bigint }[];
    const totalRowCount = Number(totalCountResult[0]?.count || 0);

    // Get up to 20K records for export, ordered chronologically
    const ids = await db.$queryRaw(Prisma.raw(`
        SELECT id FROM Action 
        WHERE ${filterSql} 
        ORDER BY createdAt DESC 
        LIMIT 20000
    `)) as { id: number }[];

    const result = await db.action.findMany({
        where: {
            id: { in: ids.map((row) => row.id) },
        },
        ...GetFeatureReportDetailResultArgs,
        orderBy: {
            createdAt: 'desc', // Maintain chronological order
        },
    });

    // Add user hashes and flatten for CSV
    const flattenedRows = result.map((row) => {
        const rowWithHash = {
            ...row,
            userHash: GetAnonymizedUserHash(row.userId, filterSql),
        };
        return flattenActivityRecord(rowWithHash);
    });

    const csvContent = arrayToCSV(flattenedRows);
    const filename = generateFilename(args.filterSpec);

    return {
        csvContent,
        filename,
        rowCount: flattenedRows.length,
        metrics: {
            queryTimeMs: sw.ElapsedMillis,
            totalRowCount,
        },
    };
}

export default resolver.pipe(
    resolver.zod(ZTArgs),
    resolver.authorize(Permission.view_feature_reports),
    async (args, ctx: AuthenticatedCtx): Promise<CsvExportResult | null> => {
        return await getCsvExport(args, ctx);
    }
);
