import { Prisma } from "db";


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

    // number id
    user = "user",
    song = "song",
    event = "event",
    //attendance = "attendance",
    //setlist = "setlist",

    //instrument = "instrument",
    wikiPage = "wikiPage",
    //frontpageGalleryItem = "frontpageGalleryItem",
    menuLink = "menuLink",
    // setlistPlan = "setlistPlan",
    // songCreditType = "songCreditType",
    // file = "file",
    customLink = "customLink",

    // compound id
    screenSize = "screenSize",
};
