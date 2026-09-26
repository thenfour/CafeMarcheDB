import { ActivityReportTimeBucketSize } from "@/shared/mysqlUtils";
import { Prisma } from "db";
import {
    type EventAttendancePublicId,
    type EventPublicId,
    type EventSegmentPublicId,
    type EventSongListPublicId,
    type EventStatusPublicId,
    type EventTypePublicId,
    type FrontpageGalleryItemPublicId,
    type InstrumentPublicId,
    type SongCreditTypePublicId,
    type SongPublicId,
} from "shared/publicId";
import { isPublicId } from "shared/publicId";
import { z } from "zod";
import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes } from "./activityTracking";
import * as db3 from "../../db3/db3";
//import { gFeatureReportFacetProcessors } from "./server/facetProcessor";

function projectActivitySetlist(value: { publicId: string; name: string; event: { publicId: string } } | null) {
    return value ? {
        publicId: db3.xEventSongList.parseIdentity(value.publicId),
        name: value.name,
        eventId: db3.xEvent.parseIdentity(value.event.publicId),
    } : null;
}

function projectActivitySegment(value: { publicId: string; name: string; event: { publicId: string }; startsAt: Date | null } | null) {
    return value ? {
        publicId: db3.xEventSegment.parseIdentity(value.publicId),
        name: value.name, eventId: db3.xEvent.parseIdentity(value.event.publicId), startsAt: value.startsAt,
    } : null;
}

function projectActivityGalleryItem(value: { publicId: string } | null) {
    return value ? { publicId: db3.xFrontpageGalleryItem.parseIdentity(value.publicId) } : null;
}

// manually run script to redact these in the database.
// export const redactLegacyNumericUserRoute = (uri: string | null): string | null =>
//     uri?.replace(/(\/backstage\/user\/)\d+(?=\/|[?#]|$)/gi, "$1[legacy-user]") ?? null;

export const GeneralActivityReportDetailArgs = Prisma.validator<Prisma.ActionDefaultArgs>()({
    include: {
        event: { select: { publicId: true, name: true, startsAt: true } },
        attendance: { select: { publicId: true } },
        file: { select: { publicId: true, fileLeafName: true, storedLeafName: true, externalURI: true } },
        song: { select: { publicId: true, name: true } },
        wikiPage: { select: { id: true, slug: true } },
        customLink: { select: { id: true, name: true } },
        eventSegment: { select: { publicId: true, name: true, event: { select: { publicId: true } }, startsAt: true } },
        eventSongList:
        {
            select:
            {
                publicId: true,
                name: true,
                event: { select: { publicId: true } },
            },
        },
        frontpageGalleryItem: { select: { publicId: true } },
        menuLink: { select: { id: true, caption: true } },
        setlistPlan: { select: { id: true, name: true } },
        songCreditType: {
            select: {
                publicId: true,
            },
        },
    }
});

// remove actual user & replace with anonymized hash
type GeneralActivityReportDetailDbPayload = Prisma.ActionGetPayload<typeof GeneralActivityReportDetailArgs>;
export type GeneralActivityReportDetailPayload = Omit<
    GeneralActivityReportDetailDbPayload,
    "user" | "userId" | "event" | "eventId" | "song" | "songId" | "songCreditType" | "songCreditTypeId" | "eventSongListId" | "eventSongList" | "attendanceId" | "attendance" | "eventSegmentId" | "eventSegment" | "frontpageGalleryItemId" | "frontpageGalleryItem"
> & {
    userHash: string | null;
    songId: SongPublicId | null;
    song: { publicId: SongPublicId; name: string } | null;
    songCreditTypeId: SongCreditTypePublicId | null;
    eventSegmentId: EventSegmentPublicId | null;
    eventSegment: ReturnType<typeof projectActivitySegment>;
    attendanceId: EventAttendancePublicId | null;
    attendance: { publicId: EventAttendancePublicId } | null;
    eventSongListId: EventSongListPublicId | null;
    eventSongList: ReturnType<typeof projectActivitySetlist>;
    frontpageGalleryItemId: FrontpageGalleryItemPublicId | null;
    frontpageGalleryItem: ReturnType<typeof projectActivityGalleryItem>;
    eventId: EventPublicId | null;
    event: { publicId: EventPublicId; name: string; startsAt: Date | null } | null;
};

export function projectGeneralActivityReportDetailItem(
    row: GeneralActivityReportDetailDbPayload,
    userHash: string | null,
): GeneralActivityReportDetailPayload {
    const { userId: _userId, event, eventId: _eventId, song, songId: _songId, songCreditType, songCreditTypeId: _songCreditTypeId, ...rest } = row;
    return {
        ...rest,
        uri: row.uri,
        songId: song ? db3.xSong.parseIdentity(song.publicId) : null,
        song: song ? { publicId: db3.xSong.parseIdentity(song.publicId), name: song.name } : null,
        eventSegment: projectActivitySegment(row.eventSegment),
        eventSegmentId: row.eventSegment ? db3.xEventSegment.parseIdentity(row.eventSegment.publicId) : null,
        attendanceId: row.attendance ? db3.xEventAttendance.parseIdentity(row.attendance.publicId) : null,
        attendance: row.attendance ? { publicId: db3.xEventAttendance.parseIdentity(row.attendance.publicId) } : null,
        eventSongList: projectActivitySetlist(row.eventSongList),
        eventSongListId: row.eventSongList ? db3.xEventSongList.parseIdentity(row.eventSongList.publicId) : null,
        frontpageGalleryItem: projectActivityGalleryItem(row.frontpageGalleryItem),
        frontpageGalleryItemId: row.frontpageGalleryItem
            ? db3.xFrontpageGalleryItem.parseIdentity(row.frontpageGalleryItem.publicId)
            : null,
        eventId: event ? db3.xEvent.parseIdentity(event.publicId) : null,
        event: event ? { ...event, publicId: db3.xEvent.parseIdentity(event.publicId) } : null,
        userHash,
        songCreditTypeId: songCreditType
            ? db3.xSongCreditType.parseIdentity(songCreditType.publicId)
            : null,
    };
}

export enum ActivityDetailTabId {
    // string id
    feature = "feature",
    context = "context",

    operatingSystem = "operatingSystem",
    pointerType = "pointerType",
    browser = "browser",
    deviceClass = "deviceClass",
    language = "language",
    locale = "locale",
    timezone = "timezone",
    screenSize = "screenSize",

    // number id
    user = "user",
    song = "song",
    event = "event",
    wikiPage = "wikiPage",
    menuLink = "menuLink",
    customLink = "customLink",
};

export type FacetResultBase = { count: number };

export interface FacetedBreakdownResult {
    total: {
        count: number;
    },
    metrics: {
        queryTimeMs: number;
    },
    facets: {
        features: {
            feature: ActivityFeature | string;
            count: number;
        }[],
        contexts: {
            context: string;
            count: number;
        }[],

        operatingSystems: {
            operatingSystem: OperatingSystem | string;
            count: number;
        }[],
        pointerTypes: {
            pointerType: PointerTypes;
            count: number;
        }[],
        browsers: {
            browserName: Browsers | string;
            count: number;
        }[],
        deviceClasses: {
            deviceClass: DeviceClasses;
            count: number;
        }[],
        languages: {
            language: string;
            count: number;
        }[],
        locales: {
            locale: string;
            count: number;
        }[],
        timezones: {
            timezone: string;
            count: number;
        }[],
        screenSizes: {
            width: number;
            height: number;
            count: number;
        }[],

        users: {
            userHash: string;
            count: number;
        }[],
        songs: {
            songId: SongPublicId;
            name: string;
            count: number;
        }[],
        events: {
            eventId: EventPublicId;
            // other fields?
            //id: true,
            name: string,
            startsAt: Date | null,
            statusId: EventStatusPublicId | null,
            typeId: EventTypePublicId | null,
            count: number;
        }[],
        wikiPages: {
            wikiPageId: number;
            slug: string;
            count: number;
        }[],
        menuLinks: {
            menuLinkId: number;
            name: string;
            count: number;
        }[],
        customLinks: {
            customLinkId: number;
            name: string;
            count: number;
        }[],
    }
}

export const ZFeatureReportFilterSpec = z.object({
    selectedBucket: z.string().nullable(),
    bucketSize: z.nativeEnum(ActivityReportTimeBucketSize),
    excludeYourself: z.boolean(),
    excludeSysadmins: z.boolean(),
    contextBeginsWith: z.string().optional(),

    includeFeatures: z.union([z.nativeEnum(ActivityFeature), z.string()]).array(),
    includeOperatingSystems: z.union([z.nativeEnum(OperatingSystem), z.string()]).array(),
    includePointerTypes: z.nativeEnum(PointerTypes).array(),
    includeBrowserNames: z.union([z.nativeEnum(Browsers), z.string()]).array(),
    includeDeviceClasses: z.nativeEnum(DeviceClasses).array(),
    includeTimezones: z.string().array(),
    includeLanguages: z.string().array(),
    includeLocales: z.string().array(),
    includeCustomLinkIds: z.number().array(),
    includeEventIds: z.custom<EventPublicId>(isPublicId).array(),
    includeMenuLinkIds: z.number().array(),
    includeSongIds: z.custom<SongPublicId>(isPublicId).array(),
    includeWikiPageIds: z.number().array(),

    excludeFeatures: z.union([z.nativeEnum(ActivityFeature), z.string()]).array(),
    excludeOperatingSystems: z.union([z.nativeEnum(OperatingSystem), z.string()]).array(),
    excludePointerTypes: z.nativeEnum(PointerTypes).array(),
    excludeBrowserNames: z.union([z.nativeEnum(Browsers), z.string()]).array(),
    excludeDeviceClasses: z.nativeEnum(DeviceClasses).array(),
    excludeTimezones: z.string().array(),
    excludeLanguages: z.string().array(),
    excludeLocales: z.string().array(),
    excludeCustomLinkIds: z.number().array(),
    excludeEventIds: z.custom<EventPublicId>(isPublicId).array(),
    excludeMenuLinkIds: z.number().array(),
    excludeSongIds: z.custom<SongPublicId>(isPublicId).array(),
    excludeWikiPageIds: z.number().array(),

    // screenWidths: z.number().optional(),
    // screenHeights: z.number().optional(),
});








const GetFeatureReportDetailResultArgsUnvalidated /*: Prisma.ActionDefaultArgs*/ = {
    select: {
        id: true,
        createdAt: true,
        uri: true,
        isClient: true,
        feature: true,
        queryText: true,
        context: true,
        pointerType: true,
        screenWidth: true,
        screenHeight: true,
        deviceClass: true,
        browserName: true,
        operatingSystem: true,
        language: true,
        locale: true,
        timezone: true,

        userId: true,
        fileId: true,
        eventId: true,
        songId: true,
        wikiPageId: true,
        eventSegmentId: true,
        attendanceId: true,
        customLinkId: true,
        eventSongListId: true,
        frontpageGalleryItemId: true,
        menuLinkId: true,
        setlistPlanId: true,
        songCreditTypeId: true,
        file: {
            select: {
                publicId: true,
                storedLeafName: true,
                fileLeafName: true,
                externalURI: true
            }
        },
        event: {
            select: {
                publicId: true,
                name: true,
                startsAt: true,
                type: { select: { publicId: true } },
                status: { select: { publicId: true } },
            }
        },
        song: {
            select: {
                publicId: true,
                name: true,
            }
        },
        wikiPage: {
            select: {
                id: true,
                slug: true,
            }
        },
        eventSegment: { select: { publicId: true, name: true, event: { select: { publicId: true } }, startsAt: true } },
        attendance: { select: { publicId: true } },
        customLink: { select: { id: true, name: true } },
        eventSongList: { select: { publicId: true, name: true, event: { select: { publicId: true } } } },
        frontpageGalleryItem: { select: { publicId: true } },
        menuLink: { select: { id: true, caption: true } },
        setlistPlan: { select: { id: true, name: true } },
        songCreditType: {
            select: {
                publicId: true,
                text: true,
                description: true,
                color: true,
                sortOrder: true,
                significance: true,
            },
        },
        instrument: {
            select: {
                publicId: true,
            }
        },
    }
};

export const GetFeatureReportDetailResultArgs = Prisma.validator<Prisma.ActionDefaultArgs>()(GetFeatureReportDetailResultArgsUnvalidated);

type GetFeatureReportDetailDbPayload = Prisma.ActionGetPayload<typeof GetFeatureReportDetailResultArgsUnvalidated>;

type FeatureReportSongCreditType = NonNullable<GetFeatureReportDetailDbPayload["songCreditType"]>;
export type GetFeatureReportDetailItemPayload = Omit<
    GetFeatureReportDetailDbPayload,
    "userId" | "instrument" | "event" | "eventId" | "song" | "songId" | "songCreditType" | "songCreditTypeId" | "eventSongListId" | "eventSongList" | "attendanceId" | "attendance" | "eventSegmentId" | "eventSegment" | "frontpageGalleryItemId" | "frontpageGalleryItem"
> & {
    instrumentId: InstrumentPublicId | null;
    songId: SongPublicId | null;
    song: { publicId: SongPublicId; name: string } | null;
    songCreditTypeId: SongCreditTypePublicId | null;
    eventSegmentId: EventSegmentPublicId | null;
    eventSegment: ReturnType<typeof projectActivitySegment>;
    attendanceId: EventAttendancePublicId | null;
    attendance: { publicId: EventAttendancePublicId } | null;
    eventSongListId: EventSongListPublicId | null;
    eventSongList: ReturnType<typeof projectActivitySetlist>;
    frontpageGalleryItemId: FrontpageGalleryItemPublicId | null;
    frontpageGalleryItem: ReturnType<typeof projectActivityGalleryItem>;
    songCreditType: null | (Omit<FeatureReportSongCreditType, "publicId"> & {
        publicId: SongCreditTypePublicId;
    });
    eventId: EventPublicId | null;
    event: null | (Omit<NonNullable<GetFeatureReportDetailDbPayload["event"]>, "publicId" | "type" | "status"> & {
        publicId: EventPublicId;
        typeId: EventTypePublicId | null;
        statusId: EventStatusPublicId | null;
    });
};

export function projectFeatureReportDetailItem(
    row: GetFeatureReportDetailDbPayload,
): GetFeatureReportDetailItemPayload {
    const {
        userId: _userId,
        instrument,
        event,
        eventId: _eventId,
        song,
        songId: _songId,
        songCreditType,
        songCreditTypeId: _songCreditTypeId,
        ...rest
    } = row;
    return {
        ...rest,
        uri: row.uri,
        songId: song ? db3.xSong.parseIdentity(song.publicId) : null,
        song: song ? { publicId: db3.xSong.parseIdentity(song.publicId), name: song.name } : null,
        eventSegment: projectActivitySegment(row.eventSegment),
        eventSegmentId: row.eventSegment ? db3.xEventSegment.parseIdentity(row.eventSegment.publicId) : null,
        attendanceId: row.attendance ? db3.xEventAttendance.parseIdentity(row.attendance.publicId) : null,
        attendance: row.attendance ? { publicId: db3.xEventAttendance.parseIdentity(row.attendance.publicId) } : null,
        eventSongList: projectActivitySetlist(row.eventSongList),
        eventSongListId: row.eventSongList ? db3.xEventSongList.parseIdentity(row.eventSongList.publicId) : null,
        frontpageGalleryItem: projectActivityGalleryItem(row.frontpageGalleryItem),
        frontpageGalleryItemId: row.frontpageGalleryItem
            ? db3.xFrontpageGalleryItem.parseIdentity(row.frontpageGalleryItem.publicId)
            : null,
        instrumentId: instrument ? db3.xInstrument.parseIdentity(instrument.publicId) : null,
        songCreditTypeId: songCreditType
            ? db3.xSongCreditType.parseIdentity(songCreditType.publicId)
            : null,
        songCreditType: songCreditType ? {
            ...songCreditType,
            publicId: db3.xSongCreditType.parseIdentity(songCreditType.publicId),
        } : null,
        event: event ? {
            publicId: db3.xEvent.parseIdentity(event.publicId),
            name: event.name,
            startsAt: event.startsAt,
            typeId: event.type ? db3.xEventType.parseIdentity(event.type.publicId) : null,
            statusId: event.status ? db3.xEventStatus.parseIdentity(event.status.publicId) : null,
        } : null,
        eventId: event ? db3.xEvent.parseIdentity(event.publicId) : null,
    };
}

export type TGetFeatureReportDetailResult = {
    rows: (GetFeatureReportDetailItemPayload & { userHash: string | null; })[];
    metrics: {
        queryTimeMs: number;
        totalRowCount: number;
    };
}

