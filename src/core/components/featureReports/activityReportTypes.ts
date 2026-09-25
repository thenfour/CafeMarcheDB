import { ActivityReportTimeBucketSize } from "@/shared/mysqlUtils";
import { Prisma } from "db";
import {
    type EventAttendancePublicId,
    type EventSegmentPublicId,
    type EventSongListPublicId,
    type EventStatusPublicId,
    type EventTypePublicId,
    type InstrumentPublicId,
    type SongCreditTypePublicId,
} from "shared/publicId";
import { z } from "zod";
import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes } from "./activityTracking";
import * as db3 from "../../db3/db3";
//import { gFeatureReportFacetProcessors } from "./server/facetProcessor";

function projectActivitySetlist(value: { publicId: string; name: string; eventId: number } | null) {
    return value ? {
        publicId: db3.xEventSongList.parseIdentity(value.publicId),
        name: value.name,
        eventId: value.eventId,
    } : null;
}

function projectActivitySegment(value: { publicId: string; name: string; eventId: number; startsAt: Date | null } | null) {
    return value ? {
        publicId: db3.xEventSegment.parseIdentity(value.publicId),
        name: value.name, eventId: value.eventId, startsAt: value.startsAt,
    } : null;
}

export const GeneralActivityReportDetailArgs = Prisma.validator<Prisma.ActionDefaultArgs>()({
    include: {
        event: true,
        attendance: { select: { publicId: true } },
        user: true,
        file: true,
        song: true,
        wikiPage: true,
        customLink: true,
        eventSegment: { select: { publicId: true, name: true, eventId: true, startsAt: true } },
        eventSongList:
        {
            select:
            {
                publicId: true,
                name: true,
                eventId: true,
            },
        },
        frontpageGalleryItem: true,
        menuLink: true,
        setlistPlan: true,
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
    "user" | "userId" | "songCreditType" | "songCreditTypeId" | "eventSongListId" | "eventSongList" | "attendanceId" | "attendance" | "eventSegmentId" | "eventSegment"
> & {
    userHash: string | null;
    songCreditTypeId: SongCreditTypePublicId | null;
    eventSegmentId: EventSegmentPublicId | null;
    eventSegment: ReturnType<typeof projectActivitySegment>;
    attendanceId: EventAttendancePublicId | null;
    attendance: { publicId: EventAttendancePublicId } | null;
    eventSongListId: EventSongListPublicId | null;
    eventSongList: ReturnType<typeof projectActivitySetlist>;
};

export function projectGeneralActivityReportDetailItem(
    row: GeneralActivityReportDetailDbPayload,
    userHash: string | null,
): GeneralActivityReportDetailPayload {
    const { user: _user, userId: _userId, songCreditType, songCreditTypeId: _songCreditTypeId, ...rest } = row;
    return {
        ...rest,
        eventSegment: projectActivitySegment(row.eventSegment),
        eventSegmentId: row.eventSegment ? db3.xEventSegment.parseIdentity(row.eventSegment.publicId) : null,
        attendanceId: row.attendance ? db3.xEventAttendance.parseIdentity(row.attendance.publicId) : null,
        attendance: row.attendance ? { publicId: db3.xEventAttendance.parseIdentity(row.attendance.publicId) } : null,
        eventSongList: projectActivitySetlist(row.eventSongList),
        eventSongListId: row.eventSongList ? db3.xEventSongList.parseIdentity(row.eventSongList.publicId) : null,
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
            songId: number;
            name: string;
            count: number;
        }[],
        events: {
            eventId: number;
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
    includeEventIds: z.number().array(),
    includeMenuLinkIds: z.number().array(),
    includeSongIds: z.number().array(),
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
    excludeEventIds: z.number().array(),
    excludeMenuLinkIds: z.number().array(),
    excludeSongIds: z.number().array(),
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
        user: {
            select: {
                id: true,
                name: true,
            }
        },
        file: {
            select: {
                id: true,
                storedLeafName: true,
                fileLeafName: true,
                externalURI: true
            }
        },
        event: {
            select: {
                id: true,
                name: true,
                startsAt: true,
                type: { select: { publicId: true } },
                status: { select: { publicId: true } },
            }
        },
        song: {
            select: {
                id: true,
                name: true,
            }
        },
        wikiPage: {
            select: {
                id: true,
                slug: true,
            }
        },
        eventSegment: { select: { publicId: true, name: true, eventId: true, startsAt: true } },
        attendance: { select: { publicId: true } },
        customLink: true,
        eventSongList: { select: { publicId: true, name: true, eventId: true } },
        frontpageGalleryItem: true,
        menuLink: true,
        setlistPlan: true,
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
    "instrument" | "event" | "songCreditType" | "songCreditTypeId" | "eventSongListId" | "eventSongList" | "attendanceId" | "attendance" | "eventSegmentId" | "eventSegment"
> & {
    instrumentId: InstrumentPublicId | null;
    songCreditTypeId: SongCreditTypePublicId | null;
    eventSegmentId: EventSegmentPublicId | null;
    eventSegment: ReturnType<typeof projectActivitySegment>;
    attendanceId: EventAttendancePublicId | null;
    attendance: { publicId: EventAttendancePublicId } | null;
    eventSongListId: EventSongListPublicId | null;
    eventSongList: ReturnType<typeof projectActivitySetlist>;
    songCreditType: null | (Omit<FeatureReportSongCreditType, "publicId"> & {
        publicId: SongCreditTypePublicId;
    });
    event: null | (Omit<NonNullable<GetFeatureReportDetailDbPayload["event"]>, "type" | "status"> & {
        typeId: EventTypePublicId | null;
        statusId: EventStatusPublicId | null;
    });
};

export function projectFeatureReportDetailItem(
    row: GetFeatureReportDetailDbPayload,
): GetFeatureReportDetailItemPayload {
    const {
        instrument,
        event,
        songCreditType,
        songCreditTypeId: _songCreditTypeId,
        ...rest
    } = row;
    return {
        ...rest,
        eventSegment: projectActivitySegment(row.eventSegment),
        eventSegmentId: row.eventSegment ? db3.xEventSegment.parseIdentity(row.eventSegment.publicId) : null,
        attendanceId: row.attendance ? db3.xEventAttendance.parseIdentity(row.attendance.publicId) : null,
        attendance: row.attendance ? { publicId: db3.xEventAttendance.parseIdentity(row.attendance.publicId) } : null,
        eventSongList: projectActivitySetlist(row.eventSongList),
        eventSongListId: row.eventSongList ? db3.xEventSongList.parseIdentity(row.eventSongList.publicId) : null,
        instrumentId: instrument ? db3.xInstrument.parseIdentity(instrument.publicId) : null,
        songCreditTypeId: songCreditType
            ? db3.xSongCreditType.parseIdentity(songCreditType.publicId)
            : null,
        songCreditType: songCreditType ? {
            ...songCreditType,
            publicId: db3.xSongCreditType.parseIdentity(songCreditType.publicId),
        } : null,
        event: event ? {
            id: event.id,
            name: event.name,
            startsAt: event.startsAt,
            typeId: event.type ? db3.xEventType.parseIdentity(event.type.publicId) : null,
            statusId: event.status ? db3.xEventStatus.parseIdentity(event.status.publicId) : null,
        } : null,
    };
}

export type TGetFeatureReportDetailResult = {
    rows: (GetFeatureReportDetailItemPayload & { userHash: string | null; })[];
    metrics: {
        queryTimeMs: number;
        totalRowCount: number;
    };
}

