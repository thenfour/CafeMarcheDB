import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { parsePublicId } from "shared/publicId";
import type { ActivityDetailRow, FacetedBreakdownInput } from "src/core/components/featureReports/activityReportTypes";
import { emptyActivityFacetFilters } from "src/core/components/featureReports/ClientFacetHandlers";

export const activityExportInput: FacetedBreakdownInput = {
    bandPublicId: parsePublicId<"Band">("ActivityBand0001"), routeLocale: "fr-BE",
    startDate: new Date("2026-01-01"), endDateExclusive: new Date("2026-02-01"), selectedBucket: "all",
    filterSpec: { bucketSize: ActivityReportTimeBucketSize.all, excludeYourself: false, excludeSysadmins: false,
        contextBeginsWith: null, includeFeatures: [], excludeFeatures: [] }, facetFilters: emptyActivityFacetFilters(),
};

export function activityExportRow(overrides: Partial<ActivityDetailRow> = {}): ActivityDetailRow {
    return { rowKey: "a".repeat(64), createdAt: new Date("2026-01-01T23:15:00Z"), userHash: null, feature: "link_follow_internal",
        context: "App/association", isClient: true, uri: null, queryText: null, pointerType: "mouse", screenWidth: 0, screenHeight: 1080,
        deviceClass: "desktop", browserName: "chrome", operatingSystem: "windows", language: "fr", locale: "fr-be", timezone: "Europe/Brussels",
        song: { publicId: parsePublicId<"Song">("ActivitySong0001"), name: "Chanson été" },
        event: { publicId: parsePublicId<"Event">("ActivityEvent001"), name: "Fête d'été", startsAt: new Date("2026-01-01T23:30:00Z"), statusId: null, typeId: null },
        wikiPage: { publicId: parsePublicId<"WikiPage">("ActivityWiki0001"), slug: "help/été" },
        menuLink: { publicId: parsePublicId<"MenuLink">("ActivityMenu0001"), caption: "Navigation française" }, customLink: null,
        file: { publicId: parsePublicId<"File">("ActivityFile0001"), fileLeafName: "Score.pdf" }, eventSegment: null, eventSongList: null,
        frontpageGalleryItem: null, setlistPlan: null, songCreditType: null, attendance: null, instrument: null, ...overrides };
}

/** Decode the exported transport independently, including quoted commas, quotes and embedded line breaks. */
export function parseActivityCsv(content: string): string[][] {
    const records: string[][] = [];
    let record: string[] = [], field = "", quoted = false;
    for (let index = 0; index < content.length; index++) {
        const character = content[index];
        if (character === '"') {
            if (quoted && content[index + 1] === '"') {
                field += '"';
                index++;
            } else {
                quoted = !quoted;
            }
        } else if (character === "," && !quoted) {
            record.push(field);
            field = "";
        } else if (character === "\n" && !quoted) {
            record.push(field.endsWith("\r") ? field.slice(0, -1) : field);
            records.push(record);
            record = [];
            field = "";
        } else {
            field += character;
        }
    }
    if (field || record.length) {
        records.push([...record, field]);
    }
    return records;
}

export function activityCsvRecord(records: readonly string[][], index: number): ReadonlyMap<string, string> {
    const values = records[index + 1];
    if (!values) {
        throw new Error("Missing CSV fixture record.");
    }
    return new Map(records[0]!.map((header, field) => [header, values[field]!]));
}
