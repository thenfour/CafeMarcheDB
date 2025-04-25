import { Prisma } from "db";
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


