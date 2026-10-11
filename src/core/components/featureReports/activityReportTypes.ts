import { z } from "zod";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { BandPublicIdSchema, PresentationInputSchema } from "src/locale/shared/presentationInput";
import { isPublicId, parsePublicId, type SongPublicId, type EventPublicId, type WikiPagePublicId, type MenuLinkPublicId, type CustomLinkPublicId } from "shared/publicId";
import type { EventStatusPublicId, EventTypePublicId } from "shared/publicId";
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
export interface ActivityReportReferences {
    readonly songs: readonly ActivitySongReference[]; readonly events: readonly ActivityEventReference[];
    readonly wikiPages: readonly ActivityWikiReference[]; readonly menuLinks: readonly ActivityMenuReference[];
    readonly customLinks: readonly ActivityCustomLinkReference[];
}
/** Explicit projection: saved URLs/search text and auxiliary references await their disclosure owners. */
export interface ActivityDetailRow {
    readonly rowKey: string; readonly createdAt: Date; readonly userHash: string | null;
    readonly feature: string; readonly context: string | null; readonly isClient: boolean;
    readonly pointerType: string | null; readonly screenWidth: number | null; readonly screenHeight: number | null;
    readonly deviceClass: string | null; readonly browserName: string | null; readonly operatingSystem: string | null;
    readonly language: string | null; readonly locale: string | null; readonly timezone: string | null;
    readonly song: ActivitySongReference | null; readonly event: ActivityEventReference | null;
    readonly wikiPage: ActivityWikiReference | null; readonly menuLink: ActivityMenuReference | null;
    readonly customLink: ActivityCustomLinkReference | null;
}
export interface ActivityDetailResult {
    readonly rows: readonly ActivityDetailRow[]; readonly timeZone: string; readonly rowLimit: number;
    readonly metrics: { readonly queryTimeMs: number; readonly totalRowCount: number };
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

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/activityReportTypes.ts:1-511
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: 48ac3ea597cc9753d791e0585bf6d91d5aae19561db63b181aeb90a95a723541
// MIGRATION_REFERENCE_BEGIN
// import { ActivityReportTimeBucketSize } from "@/shared/mysqlUtils";
// import { Prisma } from "db";
// import {
//     type EventAttendancePublicId,
//     type CustomLinkPublicId,
//     type EventPublicId,
//     type EventSegmentPublicId,
//     type EventSongListPublicId,
//     type EventStatusPublicId,
//     type EventTypePublicId,
//     type FrontpageGalleryItemPublicId,
//     type InstrumentPublicId,
//     type MenuLinkPublicId,
//     type SongCreditTypePublicId,
//     type SongPublicId,
//     type SetlistPlanPublicId,
//     type WikiPagePublicId,
// } from "shared/publicId";
// import { isPublicId } from "shared/publicId";
// import { z } from "zod";
// import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes } from "./activityTracking";
// import * as db3 from "../../db3/db3";
// //import { gFeatureReportFacetProcessors } from "./server/facetProcessor";
//
// function projectActivitySetlist(value: { publicId: string; name: string; event: { publicId: string } } | null) {
//     return value ? {
//         publicId: db3.xEventSongList.parseIdentity(value.publicId),
//         name: value.name,
//         eventId: db3.xEvent.parseIdentity(value.event.publicId),
//     } : null;
// }
//
// function projectActivitySegment(value: { publicId: string; name: string; event: { publicId: string }; startsAt: Date | null } | null) {
//     return value ? {
//         publicId: db3.xEventSegment.parseIdentity(value.publicId),
//         name: value.name, eventId: db3.xEvent.parseIdentity(value.event.publicId), startsAt: value.startsAt,
//     } : null;
// }
//
// function projectActivityGalleryItem(value: { publicId: string } | null) {
//     return value ? { publicId: db3.xFrontpageGalleryItem.parseIdentity(value.publicId) } : null;
// }
//
// function projectActivityPlan(value: { publicId: string; name: string } | null) {
//     return value ? { publicId: db3.xSetlistPlan.parseIdentity(value.publicId), name: value.name } : null;
// }
//
// function projectActivityCustomLink(value: { publicId: string; name: string } | null) {
//     return value ? { publicId: db3.xCustomLink.parseIdentity(value.publicId), name: value.name } : null;
// }
//
// function projectActivityMenuLink(value: { publicId: string; caption: string } | null) {
//     return value ? { publicId: db3.xMenuLink.parseIdentity(value.publicId), caption: value.caption } : null;
// }
//
// // manually run script to redact these in the database.
// // export const redactLegacyNumericUserRoute = (uri: string | null): string | null =>
// //     uri?.replace(/(\/backstage\/user\/)\d+(?=\/|[?#]|$)/gi, "$1[legacy-user]") ?? null;
//
// export const GeneralActivityReportDetailArgs = Prisma.validator<Prisma.ActionDefaultArgs>()({
//     include: {
//         event: { select: { publicId: true, name: true, startsAt: true } },
//         attendance: { select: { publicId: true } },
//         file: { select: { publicId: true, fileLeafName: true, storedLeafName: true, externalURI: true } },
//         song: { select: { publicId: true, name: true } },
//         wikiPage: { select: { publicId: true, slug: true } },
//         customLink: { select: { publicId: true, name: true } },
//         eventSegment: { select: { publicId: true, name: true, event: { select: { publicId: true } }, startsAt: true } },
//         eventSongList:
//         {
//             select:
//             {
//                 publicId: true,
//                 name: true,
//                 event: { select: { publicId: true } },
//             },
//         },
//         frontpageGalleryItem: { select: { publicId: true } },
//         menuLink: { select: { publicId: true, caption: true } },
//         setlistPlan: { select: { publicId: true, name: true } },
//         songCreditType: {
//             select: {
//                 publicId: true,
//             },
//         },
//     }
// });
//
// // remove actual user & replace with anonymized hash
// type GeneralActivityReportDetailDbPayload = Prisma.ActionGetPayload<typeof GeneralActivityReportDetailArgs>;
// export type GeneralActivityReportDetailPayload = Omit<
//     GeneralActivityReportDetailDbPayload,
//     "user" | "userId" | "event" | "eventId" | "song" | "songId" | "wikiPage" | "wikiPageId" | "songCreditType" | "songCreditTypeId" | "eventSongListId" | "eventSongList" | "attendanceId" | "attendance" | "eventSegmentId" | "eventSegment" | "frontpageGalleryItemId" | "frontpageGalleryItem" | "setlistPlanId" | "setlistPlan" | "customLinkId" | "customLink" | "menuLinkId" | "menuLink"
// > & {
//     userHash: string | null;
//     songId: SongPublicId | null;
//     song: { publicId: SongPublicId; name: string } | null;
//     wikiPageId: WikiPagePublicId | null;
//     wikiPage: { publicId: WikiPagePublicId; slug: string } | null;
//     songCreditTypeId: SongCreditTypePublicId | null;
//     eventSegmentId: EventSegmentPublicId | null;
//     eventSegment: ReturnType<typeof projectActivitySegment>;
//     attendanceId: EventAttendancePublicId | null;
//     attendance: { publicId: EventAttendancePublicId } | null;
//     eventSongListId: EventSongListPublicId | null;
//     eventSongList: ReturnType<typeof projectActivitySetlist>;
//     frontpageGalleryItemId: FrontpageGalleryItemPublicId | null;
//     frontpageGalleryItem: ReturnType<typeof projectActivityGalleryItem>;
//     setlistPlanId: SetlistPlanPublicId | null;
//     setlistPlan: ReturnType<typeof projectActivityPlan>;
//     eventId: EventPublicId | null;
//     event: { publicId: EventPublicId; name: string; startsAt: Date | null } | null;
//     customLinkId: CustomLinkPublicId | null;
//     customLink: ReturnType<typeof projectActivityCustomLink>;
//     menuLinkId: MenuLinkPublicId | null;
//     menuLink: ReturnType<typeof projectActivityMenuLink>;
// };
//
// export function projectGeneralActivityReportDetailItem(
//     row: GeneralActivityReportDetailDbPayload,
//     userHash: string | null,
// ): GeneralActivityReportDetailPayload {
//     const { userId: _userId, event, eventId: _eventId, song, songId: _songId, wikiPage, wikiPageId: _wikiPageId, songCreditType, songCreditTypeId: _songCreditTypeId, setlistPlanId: _setlistPlanId, setlistPlan: _setlistPlan, customLink, customLinkId: _customLinkId, menuLink, menuLinkId: _menuLinkId, ...rest } = row;
//     return {
//         ...rest,
//         uri: row.uri,
//         songId: song ? db3.xSong.parseIdentity(song.publicId) : null,
//         song: song ? { publicId: db3.xSong.parseIdentity(song.publicId), name: song.name } : null,
//         wikiPageId: wikiPage ? db3.xWikiPage.parseIdentity(wikiPage.publicId) : null,
//         wikiPage: wikiPage ? { publicId: db3.xWikiPage.parseIdentity(wikiPage.publicId), slug: wikiPage.slug } : null,
//         eventSegment: projectActivitySegment(row.eventSegment),
//         eventSegmentId: row.eventSegment ? db3.xEventSegment.parseIdentity(row.eventSegment.publicId) : null,
//         attendanceId: row.attendance ? db3.xEventAttendance.parseIdentity(row.attendance.publicId) : null,
//         attendance: row.attendance ? { publicId: db3.xEventAttendance.parseIdentity(row.attendance.publicId) } : null,
//         eventSongList: projectActivitySetlist(row.eventSongList),
//         eventSongListId: row.eventSongList ? db3.xEventSongList.parseIdentity(row.eventSongList.publicId) : null,
//         frontpageGalleryItem: projectActivityGalleryItem(row.frontpageGalleryItem),
//         setlistPlan: projectActivityPlan(row.setlistPlan),
//         setlistPlanId: row.setlistPlan ? db3.xSetlistPlan.parseIdentity(row.setlistPlan.publicId) : null,
//         frontpageGalleryItemId: row.frontpageGalleryItem
//             ? db3.xFrontpageGalleryItem.parseIdentity(row.frontpageGalleryItem.publicId)
//             : null,
//         eventId: event ? db3.xEvent.parseIdentity(event.publicId) : null,
//         event: event ? { ...event, publicId: db3.xEvent.parseIdentity(event.publicId) } : null,
//         customLinkId: customLink ? db3.xCustomLink.parseIdentity(customLink.publicId) : null,
//         customLink: projectActivityCustomLink(customLink),
//         menuLinkId: menuLink ? db3.xMenuLink.parseIdentity(menuLink.publicId) : null,
//         menuLink: projectActivityMenuLink(menuLink),
//         userHash,
//         songCreditTypeId: songCreditType
//             ? db3.xSongCreditType.parseIdentity(songCreditType.publicId)
//             : null,
//     };
// }
//
// export enum ActivityDetailTabId {
//     // string id
//     feature = "feature",
//     context = "context",
//
//     operatingSystem = "operatingSystem",
//     pointerType = "pointerType",
//     browser = "browser",
//     deviceClass = "deviceClass",
//     language = "language",
//     locale = "locale",
//     timezone = "timezone",
//     screenSize = "screenSize",
//
//     // number id
//     user = "user",
//     song = "song",
//     event = "event",
//     wikiPage = "wikiPage",
//     menuLink = "menuLink",
//     customLink = "customLink",
// };
//
// export type FacetResultBase = { count: number };
//
// export interface FacetedBreakdownResult {
//     total: {
//         count: number;
//     },
//     metrics: {
//         queryTimeMs: number;
//     },
//     facets: {
//         features: {
//             feature: ActivityFeature | string;
//             count: number;
//         }[],
//         contexts: {
//             context: string;
//             count: number;
//         }[],
//
//         operatingSystems: {
//             operatingSystem: OperatingSystem | string;
//             count: number;
//         }[],
//         pointerTypes: {
//             pointerType: PointerTypes;
//             count: number;
//         }[],
//         browsers: {
//             browserName: Browsers | string;
//             count: number;
//         }[],
//         deviceClasses: {
//             deviceClass: DeviceClasses;
//             count: number;
//         }[],
//         languages: {
//             language: string;
//             count: number;
//         }[],
//         locales: {
//             locale: string;
//             count: number;
//         }[],
//         timezones: {
//             timezone: string;
//             count: number;
//         }[],
//         screenSizes: {
//             width: number;
//             height: number;
//             count: number;
//         }[],
//
//         users: {
//             userHash: string;
//             count: number;
//         }[],
//         songs: {
//             songId: SongPublicId;
//             name: string;
//             count: number;
//         }[],
//         events: {
//             eventId: EventPublicId;
//             // other fields?
//             //id: true,
//             name: string,
//             startsAt: Date | null,
//             statusId: EventStatusPublicId | null,
//             typeId: EventTypePublicId | null,
//             count: number;
//         }[],
//         wikiPages: {
//             wikiPageId: WikiPagePublicId;
//             slug: string;
//             count: number;
//         }[],
//         menuLinks: {
//             menuLinkId: MenuLinkPublicId;
//             name: string;
//             count: number;
//         }[],
//         customLinks: {
//             customLinkId: CustomLinkPublicId;
//             name: string;
//             count: number;
//         }[],
//     }
// }
//
// export const ZFeatureReportFilterSpec = z.object({
//     selectedBucket: z.string().nullable(),
//     bucketSize: z.nativeEnum(ActivityReportTimeBucketSize),
//     excludeYourself: z.boolean(),
//     excludeSysadmins: z.boolean(),
//     contextBeginsWith: z.string().optional(),
//
//     includeFeatures: z.union([z.nativeEnum(ActivityFeature), z.string()]).array(),
//     includeOperatingSystems: z.union([z.nativeEnum(OperatingSystem), z.string()]).array(),
//     includePointerTypes: z.nativeEnum(PointerTypes).array(),
//     includeBrowserNames: z.union([z.nativeEnum(Browsers), z.string()]).array(),
//     includeDeviceClasses: z.nativeEnum(DeviceClasses).array(),
//     includeTimezones: z.string().array(),
//     includeLanguages: z.string().array(),
//     includeLocales: z.string().array(),
//     includeCustomLinkIds: db3.xCustomLink.identitySchema.array(),
//     includeEventIds: z.custom<EventPublicId>(isPublicId).array(),
//     includeMenuLinkIds: db3.xMenuLink.identitySchema.array(),
//     includeSongIds: z.custom<SongPublicId>(isPublicId).array(),
//     includeWikiPageIds: db3.xWikiPage.identitySchema.array(),
//
//     excludeFeatures: z.union([z.nativeEnum(ActivityFeature), z.string()]).array(),
//     excludeOperatingSystems: z.union([z.nativeEnum(OperatingSystem), z.string()]).array(),
//     excludePointerTypes: z.nativeEnum(PointerTypes).array(),
//     excludeBrowserNames: z.union([z.nativeEnum(Browsers), z.string()]).array(),
//     excludeDeviceClasses: z.nativeEnum(DeviceClasses).array(),
//     excludeTimezones: z.string().array(),
//     excludeLanguages: z.string().array(),
//     excludeLocales: z.string().array(),
//     excludeCustomLinkIds: db3.xCustomLink.identitySchema.array(),
//     excludeEventIds: z.custom<EventPublicId>(isPublicId).array(),
//     excludeMenuLinkIds: db3.xMenuLink.identitySchema.array(),
//     excludeSongIds: z.custom<SongPublicId>(isPublicId).array(),
//     excludeWikiPageIds: db3.xWikiPage.identitySchema.array(),
//
//     // screenWidths: z.number().optional(),
//     // screenHeights: z.number().optional(),
// });
//
//
//
//
//
//
//
//
// const GetFeatureReportDetailResultArgsUnvalidated /*: Prisma.ActionDefaultArgs*/ = {
//     select: {
//         id: true,
//         createdAt: true,
//         uri: true,
//         isClient: true,
//         feature: true,
//         queryText: true,
//         context: true,
//         pointerType: true,
//         screenWidth: true,
//         screenHeight: true,
//         deviceClass: true,
//         browserName: true,
//         operatingSystem: true,
//         language: true,
//         locale: true,
//         timezone: true,
//
//         userId: true,
//         fileId: true,
//         eventId: true,
//         songId: true,
//         wikiPageId: true,
//         eventSegmentId: true,
//         attendanceId: true,
//         customLinkId: true,
//         eventSongListId: true,
//         frontpageGalleryItemId: true,
//         menuLinkId: true,
//         setlistPlanId: true,
//         songCreditTypeId: true,
//         file: {
//             select: {
//                 publicId: true,
//                 storedLeafName: true,
//                 fileLeafName: true,
//                 externalURI: true
//             }
//         },
//         event: {
//             select: {
//                 publicId: true,
//                 name: true,
//                 startsAt: true,
//                 type: { select: { publicId: true } },
//                 status: { select: { publicId: true } },
//             }
//         },
//         song: {
//             select: {
//                 publicId: true,
//                 name: true,
//             }
//         },
//         wikiPage: {
//             select: {
//                 publicId: true,
//                 slug: true,
//             }
//         },
//         eventSegment: { select: { publicId: true, name: true, event: { select: { publicId: true } }, startsAt: true } },
//         attendance: { select: { publicId: true } },
//         customLink: { select: { publicId: true, name: true } },
//         eventSongList: { select: { publicId: true, name: true, event: { select: { publicId: true } } } },
//         frontpageGalleryItem: { select: { publicId: true } },
//         menuLink: { select: { publicId: true, caption: true } },
//         setlistPlan: { select: { publicId: true, name: true } },
//         songCreditType: {
//             select: {
//                 publicId: true,
//                 text: true,
//                 description: true,
//                 color: true,
//                 sortOrder: true,
//                 significance: true,
//             },
//         },
//         instrument: {
//             select: {
//                 publicId: true,
//             }
//         },
//     }
// };
//
// export const GetFeatureReportDetailResultArgs = Prisma.validator<Prisma.ActionDefaultArgs>()(GetFeatureReportDetailResultArgsUnvalidated);
//
// type GetFeatureReportDetailDbPayload = Prisma.ActionGetPayload<typeof GetFeatureReportDetailResultArgsUnvalidated>;
//
// type FeatureReportSongCreditType = NonNullable<GetFeatureReportDetailDbPayload["songCreditType"]>;
// export type GetFeatureReportDetailItemPayload = Omit<
//     GetFeatureReportDetailDbPayload,
//     "userId" | "instrument" | "event" | "eventId" | "song" | "songId" | "wikiPage" | "wikiPageId" | "songCreditType" | "songCreditTypeId" | "eventSongListId" | "eventSongList" | "attendanceId" | "attendance" | "eventSegmentId" | "eventSegment" | "frontpageGalleryItemId" | "frontpageGalleryItem" | "setlistPlanId" | "setlistPlan" | "customLinkId" | "customLink" | "menuLinkId" | "menuLink"
// > & {
//     instrumentId: InstrumentPublicId | null;
//     songId: SongPublicId | null;
//     song: { publicId: SongPublicId; name: string } | null;
//     wikiPageId: WikiPagePublicId | null;
//     wikiPage: { publicId: WikiPagePublicId; slug: string } | null;
//     songCreditTypeId: SongCreditTypePublicId | null;
//     eventSegmentId: EventSegmentPublicId | null;
//     eventSegment: ReturnType<typeof projectActivitySegment>;
//     attendanceId: EventAttendancePublicId | null;
//     attendance: { publicId: EventAttendancePublicId } | null;
//     eventSongListId: EventSongListPublicId | null;
//     eventSongList: ReturnType<typeof projectActivitySetlist>;
//     frontpageGalleryItemId: FrontpageGalleryItemPublicId | null;
//     frontpageGalleryItem: ReturnType<typeof projectActivityGalleryItem>;
//     setlistPlanId: SetlistPlanPublicId | null;
//     setlistPlan: ReturnType<typeof projectActivityPlan>;
//     songCreditType: null | (Omit<FeatureReportSongCreditType, "publicId"> & {
//         publicId: SongCreditTypePublicId;
//     });
//     eventId: EventPublicId | null;
//     customLinkId: CustomLinkPublicId | null;
//     customLink: ReturnType<typeof projectActivityCustomLink>;
//     menuLinkId: MenuLinkPublicId | null;
//     menuLink: ReturnType<typeof projectActivityMenuLink>;
//     event: null | (Omit<NonNullable<GetFeatureReportDetailDbPayload["event"]>, "publicId" | "type" | "status"> & {
//         publicId: EventPublicId;
//         typeId: EventTypePublicId | null;
//         statusId: EventStatusPublicId | null;
//     });
// };
//
// export function projectFeatureReportDetailItem(
//     row: GetFeatureReportDetailDbPayload,
// ): GetFeatureReportDetailItemPayload {
//     const {
//         userId: _userId,
//         instrument,
//         event,
//         eventId: _eventId,
//         song,
//         songId: _songId,
//         wikiPage,
//         wikiPageId: _wikiPageId,
//         customLink,
//         customLinkId: _customLinkId,
//         menuLink,
//         menuLinkId: _menuLinkId,
//         songCreditType,
//         songCreditTypeId: _songCreditTypeId,
//         setlistPlanId: _setlistPlanId,
//         setlistPlan: _setlistPlan,
//         ...rest
//     } = row;
//     return {
//         ...rest,
//         uri: row.uri,
//         songId: song ? db3.xSong.parseIdentity(song.publicId) : null,
//         song: song ? { publicId: db3.xSong.parseIdentity(song.publicId), name: song.name } : null,
//         wikiPageId: wikiPage ? db3.xWikiPage.parseIdentity(wikiPage.publicId) : null,
//         wikiPage: wikiPage ? { publicId: db3.xWikiPage.parseIdentity(wikiPage.publicId), slug: wikiPage.slug } : null,
//         customLinkId: customLink ? db3.xCustomLink.parseIdentity(customLink.publicId) : null,
//         customLink: projectActivityCustomLink(customLink),
//         menuLinkId: menuLink ? db3.xMenuLink.parseIdentity(menuLink.publicId) : null,
//         menuLink: projectActivityMenuLink(menuLink),
//         eventSegment: projectActivitySegment(row.eventSegment),
//         eventSegmentId: row.eventSegment ? db3.xEventSegment.parseIdentity(row.eventSegment.publicId) : null,
//         attendanceId: row.attendance ? db3.xEventAttendance.parseIdentity(row.attendance.publicId) : null,
//         attendance: row.attendance ? { publicId: db3.xEventAttendance.parseIdentity(row.attendance.publicId) } : null,
//         eventSongList: projectActivitySetlist(row.eventSongList),
//         eventSongListId: row.eventSongList ? db3.xEventSongList.parseIdentity(row.eventSongList.publicId) : null,
//         frontpageGalleryItem: projectActivityGalleryItem(row.frontpageGalleryItem),
//         setlistPlan: projectActivityPlan(row.setlistPlan),
//         setlistPlanId: row.setlistPlan ? db3.xSetlistPlan.parseIdentity(row.setlistPlan.publicId) : null,
//         frontpageGalleryItemId: row.frontpageGalleryItem
//             ? db3.xFrontpageGalleryItem.parseIdentity(row.frontpageGalleryItem.publicId)
//             : null,
//         instrumentId: instrument ? db3.xInstrument.parseIdentity(instrument.publicId) : null,
//         songCreditTypeId: songCreditType
//             ? db3.xSongCreditType.parseIdentity(songCreditType.publicId)
//             : null,
//         songCreditType: songCreditType ? {
//             ...songCreditType,
//             publicId: db3.xSongCreditType.parseIdentity(songCreditType.publicId),
//         } : null,
//         event: event ? {
//             publicId: db3.xEvent.parseIdentity(event.publicId),
//             name: event.name,
//             startsAt: event.startsAt,
//             typeId: event.type ? db3.xEventType.parseIdentity(event.type.publicId) : null,
//             statusId: event.status ? db3.xEventStatus.parseIdentity(event.status.publicId) : null,
//         } : null,
//         eventId: event ? db3.xEvent.parseIdentity(event.publicId) : null,
//     };
// }
//
// export type TGetFeatureReportDetailResult = {
//     rows: (GetFeatureReportDetailItemPayload & { userHash: string | null; })[];
//     metrics: {
//         queryTimeMs: number;
//         totalRowCount: number;
//     };
// }
// MIGRATION_REFERENCE_END
