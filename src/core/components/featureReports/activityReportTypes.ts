import { MySqlDateTimeLiteral, MySqlStringLiteral, MySqlStringLiteralAllowingPercent, MySqlSymbol, parseBucketToDateRange } from "@/shared/mysqlUtils";
import { UserWithRolesPayload } from "@/types";
import { Prisma } from "db";
import { z } from "zod";
import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes } from "./activityTracking";
import { gFeatureReportFacetProcessors } from "./server/facetProcessor";


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
    includeOperatingSystems: z.nativeEnum(OperatingSystem).array(),
    includePointerTypes: z.nativeEnum(PointerTypes).array(),
    includeBrowserNames: z.nativeEnum(Browsers).array(),
    includeDeviceClasses: z.nativeEnum(DeviceClasses).array(),
    includeTimezones: z.string().array(),
    includeLanguages: z.string().array(),
    includeLocales: z.string().array(),
    includeCustomLinkIds: z.number().array(),
    includeEventIds: z.number().array(),
    includeMenuLinkIds: z.number().array(),
    includeSongIds: z.number().array(),
    includeWikiPageIds: z.number().array(),

    excludeFeatures: z.nativeEnum(ActivityFeature).array(),
    excludeOperatingSystems: z.nativeEnum(OperatingSystem).array(),
    excludePointerTypes: z.nativeEnum(PointerTypes).array(),
    excludeBrowserNames: z.nativeEnum(Browsers).array(),
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

export type FeatureReportFilterSpec = z.infer<typeof ZFeatureReportFilterSpec>;

export function buildFeatureReportFiltersSQL(filterSpec: FeatureReportFilterSpec, currentUser: UserWithRolesPayload): string {
    if (!filterSpec.selectedBucket) {
        throw new Error("No bucket selected");
    }

    const dateRange = parseBucketToDateRange(filterSpec.selectedBucket, filterSpec.bucketSize);
    const conditions: string[] = [];

    conditions.push(`${MySqlSymbol("createdAt")} >= ${MySqlDateTimeLiteral(dateRange.start)}`);
    conditions.push(`${MySqlSymbol("createdAt")} <= ${MySqlDateTimeLiteral(dateRange.end)}`);

    if (filterSpec.excludeYourself) {
        conditions.push(`${MySqlSymbol("userId")} != ${currentUser.id}`);
    }
    if (filterSpec.excludeSysadmins) {
        // conditions.push(`(userId NOT IN (SELECT id FROM User WHERE isSysAdmin = 1))`);
        conditions.push(`${MySqlSymbol("userId")} NOT IN (SELECT ${MySqlSymbol("id")} FROM \`User\` WHERE ${MySqlSymbol("isSysAdmin")} = 1)`);
    }

    for (const [key, processor] of Object.entries(gFeatureReportFacetProcessors)) {
        processor.getFilterSqlConditions(filterSpec, conditions);
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

