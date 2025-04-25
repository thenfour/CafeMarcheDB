import { MySqlDateTimeLiteral, MySqlStringLiteral, MySqlStringLiteralAllowingPercent, MySqlSymbol, parseBucketToDateRange } from "@/shared/mysqlUtils";
import { UserWithRolesPayload } from "@/types";
import { Prisma } from "db";
import { z } from "zod";
import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes } from "./activityTracking";


export enum ActivityReportTimeBucketSize {
    hour = "hour",
    day = "day",
    week = "week",
    month = "month",
    year = "year",
    all = "all",
};

export const GeneralActivityReportDetailArgs = Prisma.validator<Prisma.ActionDefaultArgs>()({
    include: {
        event: true,
        user: true,
        file: true,
        song: true,
        wikiPage: true,
        customLink: true,
        eventSegment: true,
        eventSongList: true,
        frontpageGalleryItem: true,
        menuLink: true,
        setlistPlan: true,
    }
});

// remove actual user & replace with anonymized hash
export type GeneralActivityReportDetailPayload = Omit<Prisma.ActionGetPayload<typeof GeneralActivityReportDetailArgs>, "user" | "userId"> & {
    userHash: string | null;
};


// // @@index([feature, createdAt, userId, context, pointerType, deviceClass, browserName, operatingSystem, language, locale, timezone])


// export enum ActivityReportFacet {
//     // string id
//     feature = "feature",
//     context = "context",
//     user = "user",

//     pointerType = "pointerType",
//     deviceClass = "deviceClass",
//     browser = "browser",
//     operatingSystem = "operatingSystem",
//     language = "language",
//     locale = "locale",
//     timezone = "timezone",
// }

// export const ZTActivityReportArgs = z.object({

//     // created at
//     bucket: z.string(),
//     aggregateBy: z.nativeEnum(ActivityReportTimeBucketSize),

//     includeFeatures: z.nativeEnum(ActivityFeature).array(),

//     excludeYourself: z.boolean(),
//     excludeSysadmins: z.boolean(),
//     userId: z.number().optional(),

//     contextBeginsWith: z.string().optional(),

//     pointerType: z.string().optional(),
//     deviceClass: z.string().optional(),
//     browserName: z.string().optional(),
//     operatingSystem: z.string().optional(),
//     language: z.string().optional(),
//     locale: z.string().optional(),
//     timezone: z.string().optional(),

//     // filteredSongId: z.number().optional(),
//     // filteredEventId: z.number().optional(),
//     // filteredWikiPageId: z.number().optional(),
// });

// // type TFeatureAggregateReportArgs = z.infer<typeof ZTFeatureAggregateReportArgs>;

// // interface TFeatureAggregateReportResult {

// // };

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

    //attendance = "attendance",
    //setlist = "setlist",
    //instrument = "instrument",
    //frontpageGalleryItem = "frontpageGalleryItem",
    // setlistPlan = "setlistPlan",
    // songCreditType = "songCreditType",
    // file = "file",
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
            feature: ActivityFeature;
            count: number;
        }[],
        contexts: {
            context: string;
            count: number;
        }[],

        operatingSystems: {
            operatingSystem: OperatingSystem;
            count: number;
        }[],
        pointerTypes: {
            pointerType: PointerTypes;
            count: number;
        }[],
        browsers: {
            browserName: Browsers;
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
            statusId: number | null,
            typeId: number | null,
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
    includeFeatures: z.nativeEnum(ActivityFeature).array(),

    operatingSystem: z.nativeEnum(OperatingSystem).optional(),
    pointerType: z.nativeEnum(PointerTypes).optional(),
    browserName: z.nativeEnum(Browsers).optional(),
    deviceClass: z.nativeEnum(DeviceClasses).optional(),

    timezone: z.string().optional(),
    language: z.string().optional(),
    locale: z.string().optional(),
    screenWidth: z.number().optional(),
    screenHeight: z.number().optional(),

    customLinkId: z.number().optional(),
    eventId: z.number().optional(),
    menuLinkId: z.number().optional(),
    songId: z.number().optional(),
    wikiPageId: z.number().optional(),
});

export type FeatureReportFilterSpec = z.infer<typeof ZFeatureReportFilterSpec>;

export function buildFeatureReportFiltersSQL(filterSpec: FeatureReportFilterSpec, currentUser: UserWithRolesPayload): string {
    if (!filterSpec.selectedBucket) {
        throw new Error("No bucket selected");
    }

    const dateRange = parseBucketToDateRange(filterSpec.selectedBucket, filterSpec.bucketSize);
    const conditions: string[] = [];

    conditions.push(`${MySqlSymbol("createdAt")} >= ${MySqlDateTimeLiteral(dateRange.start)}`);
    conditions.push(`${MySqlSymbol("createdAt")} <= ${MySqlDateTimeLiteral(dateRange.end)}`);

    // TODO: add other filters here
    if (filterSpec.includeFeatures.length > 0) {
        conditions.push(`${MySqlSymbol("feature")} IN (${filterSpec.includeFeatures.map((f) => MySqlStringLiteral(f)).join(",")})`);
    }
    if (filterSpec.contextBeginsWith) {
        conditions.push(`${MySqlSymbol("context")} LIKE ${MySqlStringLiteralAllowingPercent(filterSpec.contextBeginsWith + "%")}`);
    }
    if (filterSpec.excludeYourself) {
        conditions.push(`${MySqlSymbol("userId")} != ${currentUser.id}`);
    }
    if (filterSpec.excludeSysadmins) {
        // conditions.push(`(userId NOT IN (SELECT id FROM User WHERE isSysAdmin = 1))`);
        conditions.push(`${MySqlSymbol("userId")} NOT IN (SELECT ${MySqlSymbol("id")} FROM \`User\` WHERE ${MySqlSymbol("isSysAdmin")} = 1)`);
    }

    if (filterSpec.operatingSystem) {
        conditions.push(`${MySqlSymbol("operatingSystem")} = ${MySqlStringLiteral(filterSpec.operatingSystem)}`);
    }

    if (filterSpec.pointerType) {
        conditions.push(`${MySqlSymbol("pointerType")} = ${MySqlStringLiteral(filterSpec.pointerType)}`);
    }

    if (filterSpec.browserName) {
        conditions.push(`${MySqlSymbol("browserName")} = ${MySqlStringLiteral(filterSpec.browserName)}`);
    }

    if (filterSpec.deviceClass) {
        conditions.push(`${MySqlSymbol("deviceClass")} = ${MySqlStringLiteral(filterSpec.deviceClass)}`);
    }

    if (filterSpec.timezone) {
        conditions.push(`${MySqlSymbol("timezone")} = ${MySqlStringLiteral(filterSpec.timezone)}`);
    }

    if (filterSpec.language) {
        conditions.push(`${MySqlSymbol("language")} = ${MySqlStringLiteral(filterSpec.language)}`);
    }

    if (filterSpec.locale) {
        conditions.push(`${MySqlSymbol("locale")} = ${MySqlStringLiteral(filterSpec.locale)}`);
    }

    if (filterSpec.screenWidth) {
        conditions.push(`${MySqlSymbol("screenWidth")} = ${filterSpec.screenWidth}`);
    }

    if (filterSpec.screenHeight) {
        conditions.push(`${MySqlSymbol("screenHeight")} = ${filterSpec.screenHeight}`);
    }

    if (filterSpec.customLinkId) {
        conditions.push(`${MySqlSymbol("customLinkId")} = ${filterSpec.customLinkId}`);
    }

    if (filterSpec.eventId) {
        conditions.push(`${MySqlSymbol("eventId")} = ${filterSpec.eventId}`);
    }

    if (filterSpec.menuLinkId) {
        conditions.push(`${MySqlSymbol("menuLinkId")} = ${filterSpec.menuLinkId}`);
    }

    if (filterSpec.songId) {
        conditions.push(`${MySqlSymbol("songId")} = ${filterSpec.songId}`);
    }

    if (filterSpec.wikiPageId) {
        conditions.push(`${MySqlSymbol("wikiPageId")} = ${filterSpec.wikiPageId}`);
    }

    return conditions.join(" AND ");
}








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
        instrumentId: true,

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
                typeId: true,
                statusId: true,
                startsAt: true,
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
        eventSegment: true,
        attendance: true,
        customLink: true,
        eventSongList: true,
        frontpageGalleryItem: true,
        menuLink: true,
        setlistPlan: true,
        songCreditType: true,
        instrument: true,
    }
};

export const GetFeatureReportDetailResultArgs = Prisma.validator<Prisma.ActionDefaultArgs>()(GetFeatureReportDetailResultArgsUnvalidated);

export type GetFeatureReportDetailItemPayload = Prisma.ActionGetPayload<typeof GetFeatureReportDetailResultArgsUnvalidated>;

export type TGetFeatureReportDetailResult = {
    rows: (GetFeatureReportDetailItemPayload & { userHash: string | null; })[];
    metrics: {
        queryTimeMs: number;
    };
}

