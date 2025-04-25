import { hash256 } from "@blitzjs/auth";
import { FacetedBreakdownResult } from "../activityReportTypes";
import { ActivityFeature, Browsers, DeviceClasses, OperatingSystem, PointerTypes } from "../activityTracking";
import { xCustomLink, xEvent, xMenuLink, xSong, xWikiPage } from "@/src/core/db3/db3";
import { UserWithRolesPayload } from "@/types";

export interface FacetProcessor<T> {
    getGroupedQuery: (filterSql: string, currentUser: UserWithRolesPayload) => string;
    postProcessRow: (row: unknown, filterSql: string, currentUser: UserWithRolesPayload) => T | null; // if null, excluded.
}

const NullFacetProcessor: FacetProcessor<null> = {
    getGroupedQuery: () => {
        return `select 1`;
    },
    postProcessRow: (row: any) => null,
};

export const TotalFacetProcessor: FacetProcessor<FacetedBreakdownResult['total']> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              COUNT(*) AS count
            FROM Action
            WHERE ${filterSql}
          `;
    },
    postProcessRow: (row: { count: bigint }) => ({
        count: Number(row.count),
    }),
};

const featuresFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['features'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              feature,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and feature IS NOT NULL
            GROUP BY feature
          `;
    },
    postProcessRow: (row: { feature: string, count: bigint }) => ({
        feature: row.feature as ActivityFeature,
        count: Number(row.count),
    }),
};

const contextsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['contexts'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              context,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and context IS NOT NULL
            GROUP BY context
          `;
    },
    postProcessRow: (row: { context: string, count: bigint }) => ({
        context: row.context,
        count: Number(row.count),
    }),
};

const browsersFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['browsers'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              browserName,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and browserName IS NOT NULL
            GROUP BY browserName
          `;
    },
    postProcessRow: (row: { browserName: string, count: bigint }) => {
        return ({
            browserName: row.browserName as Browsers,
            count: Number(row.count),
        });
    }
    ,
};

const operatingSystemsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['operatingSystems'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              operatingSystem,
              COUNT(*) AS count
            FROM Action
            WHERE 
                ${filterSql}
                and operatingSystem IS NOT NULL
            GROUP BY operatingSystem
          `;
    },
    postProcessRow: (row: { operatingSystem: string, count: bigint }) => {
        return ({
            operatingSystem: row.operatingSystem as OperatingSystem,
            count: Number(row.count),
        });
    },
};

const pointerTypesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['pointerTypes'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              pointerType,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and pointerType IS NOT NULL
            GROUP BY pointerType
          `;
    },
    postProcessRow: (row: { pointerType: string, count: bigint }) => {
        return ({
            pointerType: row.pointerType as PointerTypes,
            count: Number(row.count),
        });
    },
};

const deviceClassesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['deviceClasses'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              deviceClass,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and deviceClass IS NOT NULL
            GROUP BY deviceClass
          `;
    },
    postProcessRow: (row: { deviceClass: string, count: bigint }) => {
        return ({
            deviceClass: row.deviceClass as DeviceClasses,
            count: Number(row.count),
        });
    },
};

const languagesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['languages'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              language,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and language IS NOT NULL
            GROUP BY language
          `;
    },
    postProcessRow: (row: { language: string, count: bigint }) => {
        return ({
            language: row.language,
            count: Number(row.count),
        });
    },
};

const localesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['locales'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              locale,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and locale IS NOT NULL
            GROUP BY locale
          `;
    },
    postProcessRow: (row: { locale: string, count: bigint }) => {
        return ({
            locale: row.locale,
            count: Number(row.count),
        });
    },
};

const timezonesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['timezones'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              timezone,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and timezone IS NOT NULL
            GROUP BY timezone
          `;
    },
    postProcessRow: (row: { timezone: string, count: bigint }) => {
        return ({
            timezone: row.timezone,
            count: Number(row.count),
        });
    },
};

const screenSizesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['screenSizes'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
            SELECT
              screenHeight, screenWidth,
              COUNT(*) AS count
            FROM Action
            WHERE
                ${filterSql}
                and screenHeight IS NOT NULL
                and screenWidth IS NOT NULL
            GROUP BY screenHeight, screenWidth
          `;
    },
    postProcessRow: (row: { screenHeight: number, screenWidth: number, count: bigint }) => {
        return ({
            height: row.screenHeight,
            width: row.screenWidth,
            count: Number(row.count),
        });
    },
};

export const GetAnonymizedUserHash = (userId: number | null, filterSql: string) => {
    if (!userId) {
        return null;
    }
    const anonymizedUserId = `${filterSql}_5e0a4383307e4eb8322397d4bce4de0375e37c1a6c76bdb39abf5143e538b01b_${userId}`;
    return hash256(anonymizedUserId);
};

const anonymizedUsersFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['users'][0]> = {
    getGroupedQuery: (filterSql) => {
        return `
              SELECT
                userId,
                COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and userId IS NOT NULL
              GROUP BY userId
          `;
    },
    postProcessRow: (row: { userId: number, count: bigint }, filterSql) => {
        // to anonymize users as much as possible, hash their userID with a deterministic salt
        // which is a hash of query params.
        return ({
            userHash: GetAnonymizedUserHash(row.userId, filterSql)!,
            count: Number(row.count),
        });
    },
};

const songsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['songs'][0]> = {
    getGroupedQuery: (filterSql, currentUser) => {
        return `
            WITH FilteredSet AS (
              SELECT songId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and songId IS NOT NULL
              GROUP BY songId
            )
            SELECT
              s.id AS songId,
              s.name,
              fs.count
            FROM FilteredSet fs
            JOIN Song s ON fs.songId = s.id
            WHERE ${xSong.SqlGetVisFilterExpression(currentUser, "s")}
          `;
    },
    postProcessRow: (row: { songId: number, name: string, count: bigint }) => ({
        songId: row.songId,
        name: row.name,
        count: Number(row.count),
    }),
};

const eventsFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['events'][0]> = {
    getGroupedQuery: (filterSql, currentUser) => {
        return `
            WITH FilteredSet AS (
              SELECT eventId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and eventId IS NOT NULL
              GROUP BY eventId
            )
            SELECT
              e.id AS eventId,
              e.name,
              fs.count
            FROM FilteredSet fs
            JOIN Event e ON fs.eventId = e.id
            WHERE ${xEvent.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { eventId: number, name: string, statusId: number | null, typeId: number | null, startsAt: Date | null, count: bigint }) => ({
        eventId: row.eventId,
        count: Number(row.count),
        name: row.name,
        startsAt: row.startsAt,
        statusId: row.statusId,
        typeId: row.typeId,


    }),
};

const wikiPagesFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['wikiPages'][0]> = {
    getGroupedQuery: (filterSql, currentUser) => {
        return `
            WITH FilteredSet AS (
              SELECT wikiPageId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and wikiPageId IS NOT NULL
              GROUP BY wikiPageId
            )
            SELECT
              e.id AS wikiPageId,
              e.slug,
              fs.count
            FROM FilteredSet fs
            JOIN WikiPage e ON fs.wikiPageId = e.id
            WHERE ${xWikiPage.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { wikiPageId: number, slug: string, count: bigint }) => ({
        wikiPageId: row.wikiPageId,
        slug: row.slug,
        count: Number(row.count),
    }),
};

const menuLinksFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['menuLinks'][0]> = {
    getGroupedQuery: (filterSql, currentUser) => {
        return `
            WITH FilteredSet AS (
              SELECT menuLinkId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and menuLinkId IS NOT NULL
              GROUP BY menuLinkId
            )
            SELECT
              e.id AS menuLinkId,
              e.caption,
              fs.count
            FROM FilteredSet fs
            JOIN MenuLink e ON fs.menuLinkId = e.id
            WHERE ${xMenuLink.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { menuLinkId: number, caption: string, count: bigint }) => ({
        menuLinkId: row.menuLinkId,
        name: row.caption,
        count: Number(row.count),
    }),
};

const customLinksFacetProcessor: FacetProcessor<FacetedBreakdownResult['facets']['customLinks'][0]> = {
    getGroupedQuery: (filterSql, currentUser) => {
        return `
            WITH FilteredSet AS (
              SELECT customLinkId, COUNT(*) AS count
              FROM Action
              WHERE
                ${filterSql}
                and customLinkId IS NOT NULL
              GROUP BY customLinkId
            )
            SELECT
              e.id AS customLinkId,
              e.name,
              fs.count
            FROM FilteredSet fs
            JOIN CustomLink e ON fs.customLinkId = e.id
            WHERE ${xCustomLink.SqlGetVisFilterExpression(currentUser, "e")}
          `;
    },
    postProcessRow: (row: { customLinkId: number, name: string, count: bigint }) => ({
        customLinkId: row.customLinkId,
        name: row.name,
        count: Number(row.count),
    }),
};


export const gFeatureReportFacetProcessors: Record<keyof FacetedBreakdownResult['facets'], FacetProcessor<unknown>> = {
    features: featuresFacetProcessor,
    contexts: contextsFacetProcessor,
    operatingSystems: operatingSystemsFacetProcessor,
    pointerTypes: pointerTypesFacetProcessor,
    browsers: browsersFacetProcessor,
    deviceClasses: deviceClassesFacetProcessor,
    languages: languagesFacetProcessor,
    locales: localesFacetProcessor,
    timezones: timezonesFacetProcessor,
    screenSizes: screenSizesFacetProcessor,
    users: anonymizedUsersFacetProcessor,
    songs: songsFacetProcessor,

    events: eventsFacetProcessor,
    wikiPages: wikiPagesFacetProcessor,
    menuLinks: menuLinksFacetProcessor,
    customLinks: customLinksFacetProcessor,
} as const;
