// LSMB todo: the original exported to TSV in a format such that you could double-click on it
// and get a proper open in excel. This does not; excel opens it with 1 column per line.
// also:  clean up all these repeated legacy things, hard-coded keys etc.

import type { DB3ReadContext, DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import type { ActivityCsvResult, ActivityDetailRow, FacetedBreakdownInput } from "../activityReportTypes";
import { readSelectedActivityRows } from "./activityDetails";

interface ActivityCsvColumn {
    readonly header: string;
    readonly value: (row: ActivityDetailRow) => string;
}

/** Stable original columns, followed by authorized auxiliary labels. No raw relation or storage field is exported. */
const activityCsvColumns: readonly ActivityCsvColumn[] = [
    // The retained id column now uses the selection-scoped row token, never the Action's natural ID.
    { header: "id", value: row => row.rowKey },
    { header: "createdAt", value: row => row.createdAt.toISOString() },
    { header: "feature", value: row => row.feature },
    { header: "isClient", value: row => String(row.isClient) },
    { header: "userHash", value: row => row.userHash ?? "" },
    { header: "uri", value: row => row.uri ?? "" },
    { header: "context", value: row => row.context ?? "" },
    { header: "queryText", value: row => row.queryText ?? "" },
    { header: "language", value: row => row.language ?? "" },
    { header: "locale", value: row => row.locale ?? "" },
    { header: "timezone", value: row => row.timezone ?? "" },
    { header: "screenWidth", value: row => row.screenWidth === null ? "" : String(row.screenWidth) },
    { header: "screenHeight", value: row => row.screenHeight === null ? "" : String(row.screenHeight) },
    { header: "browserName", value: row => row.browserName ?? "" },
    { header: "operatingSystem", value: row => row.operatingSystem ?? "" },
    { header: "pointerType", value: row => row.pointerType ?? "" },
    { header: "deviceClass", value: row => row.deviceClass ?? "" },
    { header: "songId", value: row => row.song?.publicId ?? "" },
    { header: "songName", value: row => row.song?.name ?? "" },
    { header: "eventId", value: row => row.event?.publicId ?? "" },
    { header: "eventName", value: row => row.event?.name ?? "" },
    { header: "eventStartsAt", value: row => row.event?.startsAt?.toISOString() ?? "" },
    { header: "eventStatusId", value: row => row.event?.statusId ?? "" },
    { header: "eventTypeId", value: row => row.event?.typeId ?? "" },
    { header: "fileId", value: row => row.file?.publicId ?? "" },
    { header: "fileName", value: row => row.file?.fileLeafName ?? "" },
    // Keep these legacy headers for analysts; physical storage and unchecked download targets stay redacted.
    { header: "fileStoredName", value: () => "" },
    { header: "fileExternalURI", value: () => "" },
    { header: "wikiPageId", value: row => row.wikiPage?.publicId ?? "" },
    { header: "wikiPageSlug", value: row => row.wikiPage?.slug ?? "" },
    { header: "attendanceId", value: row => row.attendance?.publicId ?? "" },
    { header: "instrumentId", value: row => row.instrument?.publicId ?? "" },
    { header: "eventSegmentId", value: row => row.eventSegment?.publicId ?? "" },
    { header: "customLinkId", value: row => row.customLink?.publicId ?? "" },
    { header: "eventSongListId", value: row => row.eventSongList?.publicId ?? "" },
    { header: "frontpageGalleryItemId", value: row => row.frontpageGalleryItem?.publicId ?? "" },
    { header: "menuLinkId", value: row => row.menuLink?.publicId ?? "" },
    { header: "setlistPlanId", value: row => row.setlistPlan?.publicId ?? "" },
    { header: "songCreditTypeId", value: row => row.songCreditType?.publicId ?? "" },
    { header: "attendanceCaption", value: row => row.attendance?.buttonCaption ?? "" },
    { header: "instrumentName", value: row => row.instrument?.name ?? "" },
    { header: "eventSegmentName", value: row => row.eventSegment?.name ?? "" },
    { header: "customLinkName", value: row => row.customLink?.name ?? "" },
    { header: "eventSongListName", value: row => row.eventSongList?.name ?? "" },
    { header: "menuLinkCaption", value: row => row.menuLink?.caption ?? "" },
    { header: "setlistPlanName", value: row => row.setlistPlan?.name ?? "" },
    { header: "songCreditTypeName", value: row => row.songCreditType?.name ?? "" },
];

function activityCsvCell(value: string): string {
    // Spreadsheet applications can evaluate formulas even inside quoted CSV cells.
    const safe = /^[\s\u0000-\u001f\u007f]*[=+\-@]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
}

export function activityRowsToCsv(rows: readonly ActivityDetailRow[]): string {
    const header = activityCsvColumns.map(column => activityCsvCell(column.header)).join(",");
    const records = rows.map(row => activityCsvColumns.map(column => activityCsvCell(column.value(row))).join(","));
    return [header, ...records].join("\r\n") + "\r\n";
}

function activityCsvFilename(input: FacetedBreakdownInput, date: Date): string {
    const timestamp = date.toISOString().slice(0, 19).replace(/:/g, "-");
    const bucket = input.selectedBucket.replace(/[^a-zA-Z0-9_-]/g, "-");
    return `activity-export-${input.bandPublicId}-${bucket}-${timestamp}.csv`;
}

export async function readActivityCsv(database: DB3ReadDatabase, authorization: DB3ReadContext["authorization"], input: FacetedBreakdownInput): Promise<ActivityCsvResult> {
    const result = await readSelectedActivityRows(database, authorization, input, 20000);
    return {
        csvContent: activityRowsToCsv(result.rows), filename: activityCsvFilename(input, new Date()), rowCount: result.rows.length,
        rowLimit: result.rowLimit, timeZone: result.timeZone, metrics: result.metrics
    };
}
