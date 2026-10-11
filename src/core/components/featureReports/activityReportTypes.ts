import { z } from "zod";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { BandPublicIdSchema, PresentationInputSchema } from "src/locale/shared/presentationInput";
import { isPublicId, parsePublicId, type SongPublicId, type EventPublicId, type WikiPagePublicId, type MenuLinkPublicId, type CustomLinkPublicId } from "shared/publicId";
import type { EventStatusPublicId, EventTypePublicId, FilePublicId, EventSegmentPublicId, EventSongListPublicId,
    EventAttendancePublicId, FrontpageGalleryItemPublicId, SetlistPlanPublicId, SongCreditTypePublicId, InstrumentPublicId } from "shared/publicId";
import { anonymousActivityContext } from "./activityContext";

// Timeline filters own the top-level report; selected-bucket facet filters have a separate contract.
export const ActivityTimelineFilterSchema = z.object({
    bucketSize: z.nativeEnum(ActivityReportTimeBucketSize),
    excludeYourself: z.boolean(),
    excludeSysadmins: z.boolean(),
    contextBeginsWith: z.string().max(256).nullable().refine(value => anonymousActivityContext(value) === value,
        "Activity context filters must not identify people or embedded records."),
    includeFeatures: z.array(z.string().min(1).max(64)).max(256),
    excludeFeatures: z.array(z.string().min(1).max(64)).max(256),
}).strict();
const reportDate = z.date().min(new Date("1900-01-01T00:00:00Z")).max(new Date("3000-01-01T00:00:00Z"));
export const GeneralFeatureReportInputSchema = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    startDate: reportDate,
    endDateExclusive: reportDate,
    filterSpec: ActivityTimelineFilterSchema,
}).strict().refine(value => value.startDate < value.endDateExclusive, "The report end must follow its start.");
export type ActivityTimelineFilter = z.infer<typeof ActivityTimelineFilterSchema>;
export type GeneralFeatureReportInput = z.infer<typeof GeneralFeatureReportInputSchema>;
export interface GeneralFeatureReportBucket {
    readonly bucket: string;
    readonly count: number;
}
export interface GeneralFeatureReportResult {
    readonly data: GeneralFeatureReportBucket[];
    readonly timeZone: string;
    readonly metrics: { readonly queryTimeMs: number };
}

const facetValues = z.array(z.string().min(1).max(256)).max(256);
const songIdentity = z.string().refine(isPublicId).transform(value => parsePublicId<"Song">(value));
const eventIdentity = z.string().refine(isPublicId).transform(value => parsePublicId<"Event">(value));
const wikiIdentity = z.string().refine(isPublicId).transform(value => parsePublicId<"WikiPage">(value));
const menuIdentity = z.string().refine(isPublicId).transform(value => parsePublicId<"MenuLink">(value));
const customLinkIdentity = z.string().refine(isPublicId).transform(value => parsePublicId<"CustomLink">(value));

// Facet filters refine the selected bucket. The timeline keeps its original top-level filters.
export const ActivityFacetFilterSchema = z.object({
    includeOperatingSystems: facetValues, excludeOperatingSystems: facetValues,
    includePointerTypes: facetValues, excludePointerTypes: facetValues,
    includeBrowserNames: facetValues, excludeBrowserNames: facetValues,
    includeDeviceClasses: facetValues, excludeDeviceClasses: facetValues,
    includeLanguages: facetValues, excludeLanguages: facetValues,
    includeLocales: facetValues, excludeLocales: facetValues,
    includeTimezones: facetValues, excludeTimezones: facetValues,
    includeSongIds: z.array(songIdentity).max(256), excludeSongIds: z.array(songIdentity).max(256),
    includeEventIds: z.array(eventIdentity).max(256), excludeEventIds: z.array(eventIdentity).max(256),
    includeWikiPageIds: z.array(wikiIdentity).max(256), excludeWikiPageIds: z.array(wikiIdentity).max(256),
    includeMenuLinkIds: z.array(menuIdentity).max(256), excludeMenuLinkIds: z.array(menuIdentity).max(256),
    includeCustomLinkIds: z.array(customLinkIdentity).max(256), excludeCustomLinkIds: z.array(customLinkIdentity).max(256),
}).strict();
export type ActivityFacetFilter = z.infer<typeof ActivityFacetFilterSchema>;

const activitySelectionInputSchema = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    startDate: reportDate,
    endDateExclusive: reportDate,
    filterSpec: ActivityTimelineFilterSchema,
    selectedBucket: z.string().min(1).max(32),
    facetFilters: ActivityFacetFilterSchema,
}).strict();
export const FacetedBreakdownInputSchema = activitySelectionInputSchema.refine(value => value.startDate < value.endDateExclusive, "The report end must follow its start.");
export type FacetedBreakdownInput = z.infer<typeof FacetedBreakdownInputSchema>;

// A drill-down narrows the existing selection; it never replaces its includes or exclusions.
export const ActivityDetailSelectionSchema = z.discriminatedUnion("facet", [
    z.object({ facet: z.literal("total") }).strict(),
    z.object({ facet: z.literal("features"), key: z.string().max(64) }).strict(),
    z.object({ facet: z.literal("contexts"), key: z.string().max(256).refine(value => anonymousActivityContext(value) === value) }).strict(),
    z.object({ facet: z.literal("operatingSystems"), key: z.string().max(256) }).strict(),
    z.object({ facet: z.literal("pointerTypes"), key: z.string().max(256) }).strict(),
    z.object({ facet: z.literal("browsers"), key: z.string().max(256) }).strict(),
    z.object({ facet: z.literal("deviceClasses"), key: z.string().max(256) }).strict(),
    z.object({ facet: z.literal("languages"), key: z.string().max(256) }).strict(),
    z.object({ facet: z.literal("locales"), key: z.string().max(256) }).strict(),
    z.object({ facet: z.literal("timezones"), key: z.string().max(256) }).strict(),
    z.object({ facet: z.literal("songs"), key: songIdentity }).strict(),
    z.object({ facet: z.literal("events"), key: eventIdentity }).strict(),
    z.object({ facet: z.literal("wikiPages"), key: wikiIdentity }).strict(),
    z.object({ facet: z.literal("menuLinks"), key: menuIdentity }).strict(),
    z.object({ facet: z.literal("customLinks"), key: customLinkIdentity }).strict(),
]);
export type ActivityDetailSelection = z.infer<typeof ActivityDetailSelectionSchema>;
export const ActivityDetailInputSchema = activitySelectionInputSchema.extend({ detail: ActivityDetailSelectionSchema }).strict()
    .refine(value => value.startDate < value.endDateExclusive, "The report end must follow its start.");
export type ActivityDetailInput = z.infer<typeof ActivityDetailInputSchema>;

export interface ActivitySongReference { readonly publicId: SongPublicId; readonly name: string }
export interface ActivityEventReference {
    readonly publicId: EventPublicId; readonly name: string; readonly startsAt: Date | null;
    readonly statusId: EventStatusPublicId | null; readonly typeId: EventTypePublicId | null;
}
export interface ActivityWikiReference { readonly publicId: WikiPagePublicId; readonly slug: string }
export interface ActivityMenuReference { readonly publicId: MenuLinkPublicId; readonly caption: string }
export interface ActivityCustomLinkReference { readonly publicId: CustomLinkPublicId; readonly name: string }
export interface ActivityFileReference { readonly publicId: FilePublicId; readonly fileLeafName: string }
export interface ActivitySegmentReference {
    readonly publicId: EventSegmentPublicId; readonly name: string; readonly eventId: EventPublicId; readonly startsAt: Date | null;
}
export interface ActivitySetlistReference { readonly publicId: EventSongListPublicId; readonly name: string; readonly eventId: EventPublicId }
export interface ActivityGalleryReference { readonly publicId: FrontpageGalleryItemPublicId; readonly fileId: FilePublicId }
export interface ActivityPlanReference { readonly publicId: SetlistPlanPublicId; readonly name: string }
export interface ActivityCreditTypeReference { readonly publicId: SongCreditTypePublicId; readonly name: string; readonly color: string | null }
export interface ActivityInstrumentReference { readonly publicId: InstrumentPublicId; readonly name: string; readonly color: string | null }
export interface ActivityAttendanceReference {
    readonly publicId: EventAttendancePublicId; readonly buttonCaption: string; readonly description: string;
    readonly color: string | null; readonly iconName: string | null;
}
export interface ActivityReportReferences {
    readonly songs: readonly ActivitySongReference[]; readonly events: readonly ActivityEventReference[];
    readonly wikiPages: readonly ActivityWikiReference[]; readonly menuLinks: readonly ActivityMenuReference[];
    readonly customLinks: readonly ActivityCustomLinkReference[];
}
/** Explicit projection, including metadata approved by the report's disclosure owner. */
export interface ActivityDetailRow {
    readonly rowKey: string; readonly createdAt: Date; readonly userHash: string | null;
    readonly feature: string; readonly context: string | null; readonly isClient: boolean;
    readonly uri: string | null; readonly queryText: string | null;
    readonly pointerType: string | null; readonly screenWidth: number | null; readonly screenHeight: number | null;
    readonly deviceClass: string | null; readonly browserName: string | null; readonly operatingSystem: string | null;
    readonly language: string | null; readonly locale: string | null; readonly timezone: string | null;
    readonly song: ActivitySongReference | null; readonly event: ActivityEventReference | null;
    readonly wikiPage: ActivityWikiReference | null; readonly menuLink: ActivityMenuReference | null;
    readonly customLink: ActivityCustomLinkReference | null;
    readonly file: ActivityFileReference | null; readonly eventSegment: ActivitySegmentReference | null;
    readonly eventSongList: ActivitySetlistReference | null; readonly frontpageGalleryItem: ActivityGalleryReference | null;
    readonly setlistPlan: ActivityPlanReference | null; readonly songCreditType: ActivityCreditTypeReference | null;
    readonly attendance: ActivityAttendanceReference | null; readonly instrument: ActivityInstrumentReference | null;
}
export interface ActivityDetailResult {
    readonly rows: readonly ActivityDetailRow[]; readonly timeZone: string; readonly rowLimit: number;
    readonly metrics: { readonly queryTimeMs: number; readonly totalRowCount: number };
}
export interface GeneralActivityDetailResult extends Omit<ActivityDetailResult, "rows"> {
    readonly data: readonly ActivityDetailRow[];
}
export interface ActivityCsvResult {
    readonly csvContent: string; readonly filename: string; readonly rowCount: number; readonly rowLimit: number;
    readonly timeZone: string; readonly metrics: ActivityDetailResult["metrics"];
}

export const activityFacetKeys = ["features", "contexts", "operatingSystems", "pointerTypes", "browsers", "deviceClasses",
    "languages", "locales", "timezones", "screenSizes", "users", "songs", "events", "wikiPages", "menuLinks", "customLinks"] as const;
export type ActivityFacetKey = typeof activityFacetKeys[number];
export interface ActivityFacetItem<TKey extends string = string> {
    readonly key: TKey;
    readonly label: string;
    readonly count: number;
}
export interface FacetedBreakdownResult {
    readonly references: ActivityReportReferences;
    readonly total: { readonly count: number };
    readonly timeZone: string;
    readonly metrics: { readonly queryTimeMs: number };
    readonly facets: { readonly [K in ActivityFacetKey]: readonly ActivityFacetItem[] } & {
        readonly songs: readonly ActivityFacetItem<SongPublicId>[];
        readonly events: readonly ActivityFacetItem<EventPublicId>[];
        readonly wikiPages: readonly ActivityFacetItem<WikiPagePublicId>[];
        readonly menuLinks: readonly ActivityFacetItem<MenuLinkPublicId>[];
        readonly customLinks: readonly ActivityFacetItem<CustomLinkPublicId>[];
    };
}
