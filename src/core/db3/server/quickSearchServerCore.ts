// LSMB todo: figure out a unified design for searches.
// we have
// - paginated search features + frontpage relevant events (currently using paginated faceted search; ad-hoc SQL)
// - autocomplete / main chrome search (here -- ad-hoc prisma)
// - db3 queries (native db3 prisma)

import { AuthorizationError } from "blitz";
import db, { Prisma } from "db";
import { getCalendarWindow } from "shared/dateTimePolicy";
import { Permission } from "shared/permissions";
import {
    CalculateMatchStrength, MakeWhereCondition, ParseQuickFilter, QuickSearchItemType,
    type ParseQuickFilterResult, type QuickSearchItemMatch, type SearchableTableFieldSpec
} from "shared/quickFilter";
import { slugify } from "shared/rootroot";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { withMemberPresentation } from "src/core/components/user/bandMemberLinks";
import { collectLocalePreferences, selectFormattingLocale } from "src/locale/shared/localePreferences";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { ServerApi } from "src/server/serverApi";
import type { xTable } from "../shared/db3core";
import { activeBandPersonWhere } from "../shared/entities/user/bandPersonReference";
import { QuickSearchInputSchema, type QuickSearchInput } from "../shared/quickSearchTypes";
import { instrumentDashboardView } from "../shared/references/dashboardReferences";
import { xEvent } from "../shared/schema/event";
import { xSong } from "../shared/schema/song";
import { xUser } from "../shared/schema/user";
import { xWikiPage } from "../shared/schema/wiki";
import { queryView } from "./db3QueryCore";
import { executeDB3Read, type DB3ReadContext, type DB3ReadDatabase } from "./db3ReadExecution";
import { GetAuthorizedTableReadWhere } from "./db3ReadPolicy";
import { readMatchingCurrentWikiRevisions } from "./quickSearchWiki";

const candidatesPerType = 100;
const resultsToReturn = 15;

const songFields: SearchableTableFieldSpec[] = [
    { fieldName: "publicId", fieldType: "string", strengthMultiplier: 1 },
    { fieldName: "aliases", fieldType: "string", strengthMultiplier: 0.7 },
    { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
    { fieldName: "description", fieldType: "string", strengthMultiplier: 0.5 },
];

const eventFields: SearchableTableFieldSpec[] = [
    { fieldName: "publicId", fieldType: "string", strengthMultiplier: 1 },
    { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
    { fieldName: "locationDescription", fieldType: "string", strengthMultiplier: 0.5 },
    { fieldName: "startsAt", fieldType: "date", strengthMultiplier: 1 },
];
const eventContentFields: SearchableTableFieldSpec[] = [{ fieldName: "content", fieldType: "string", strengthMultiplier: 1 }];
const wikiFields: SearchableTableFieldSpec[] = [{ fieldName: "slug", fieldType: "string", strengthMultiplier: 1 }];
const wikiRevisionFields: SearchableTableFieldSpec[] = [
    { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
    { fieldName: "content", fieldType: "string", strengthMultiplier: 0.5 },
];
const instrumentFields: SearchableTableFieldSpec[] = [
    { fieldName: "publicId", fieldType: "string", strengthMultiplier: 1 },
    { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
    { fieldName: "description", fieldType: "string", strengthMultiplier: 0.5 },
];
const personFields: SearchableTableFieldSpec[] = [{ fieldName: "name", fieldType: "string", strengthMultiplier: 1 }];

// lsmb todo: use a robust routing mechanism to generate URLs
function contextualUri(path: string, input: QuickSearchInput): string {
    return ServerApi.getAbsoluteUri(withMemberPresentation(path, input));
}

async function readSongMatches(context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput) {
    // A1 defers localized tag-name matching; authored fields retain their grammar and weights.
    const authoredWhere: Prisma.SongWhereInput = MakeWhereCondition(songFields, query);
    const where = await GetAuthorizedTableReadWhere({ table: xSong, auth: context.authorization, where: authoredWhere });
    const songs = await context.database.song.findMany({
        where,
        select: {
            publicId: true,
            name: true,
            aliases: true,
            description: true,
            introducedYear: true
        },
        orderBy: { publicId: "asc" }, take: candidatesPerType,
    });
    return songs.map((song): QuickSearchItemMatch<QuickSearchItemType.song> => {
        const match = CalculateMatchStrength(songFields, song, query);
        return {
            id: xSong.parseIdentity(song.publicId),
            itemType: QuickSearchItemType.song,
            name: `${song.name}${song.introducedYear ? ` (${song.introducedYear})` : ""}`,
            // lsmb todo: use a robust routing mechanism to generate URLs
            absoluteUri: contextualUri(`/backstage/song/${song.publicId}/${slugify(song.name)}`, input),
            matchStrength: match.matchStrength,
            matchingField: match.fieldName
        };
    });
}

async function readEventMatches(context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput) {
    const auth = context.authorization;
    const eventPolicy = await GetAuthorizedTableReadWhere({ table: xEvent, auth });
    const content = xEvent.authorizeColumnForView({ auth, model: null, columnName: "descriptionWikiPage" })
        ? await readMatchingCurrentWikiRevisions(context, query, eventContentFields, { events: { is: eventPolicy } }) : [];

    const contentByPage = new Map(content.map(revision => [revision.wikiPage.id, revision]));
    const authoredWhere: Prisma.EventWhereInput = MakeWhereCondition(eventFields, query);
    const events = await context.database.event.findMany({
        select: {
            publicId: true,
            name: true,
            locationDescription: true,
            startsAt: true,
            descriptionWikiPageId: true
        },
        where: {
            AND: [
                eventPolicy,
                {
                    OR: [
                        authoredWhere,
                        { descriptionWikiPageId: { in: [...contentByPage.keys()] } }
                    ]
                }
            ]
        },
        orderBy: { publicId: "asc" },
        take: candidatesPerType,
    });
    const locale = selectFormattingLocale(collectLocalePreferences(input));
    const timeZone = await loadBandTimeZone(context.database, auth.requireBand().id);
    return events.map((event): QuickSearchItemMatch<QuickSearchItemType.event> => {
        let match = CalculateMatchStrength(eventFields, event, query);
        const revision = event.descriptionWikiPageId === null ? undefined : contentByPage.get(event.descriptionWikiPageId);
        if (revision) {
            const contentMatch = CalculateMatchStrength(eventContentFields, revision, query);
            if (contentMatch.matchStrength > match.matchStrength) {
                match = contentMatch;
            }
        }
        const date = event.startsAt?.toLocaleDateString(locale, { timeZone });
        return {
            id: xEvent.parseIdentity(event.publicId), itemType: QuickSearchItemType.event,
            name: `${event.name}${date ? ` (${date})` : ""}`,
            // lsmb todo: use a robust routing mechanism to generate URLs
            absoluteUri: contextualUri(`/backstage/event/${event.publicId}/${slugify(event.name)}`, input),
            matchStrength: match.matchStrength, matchingField: match.fieldName
        };
    });
}

async function readWikiMatches(context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput) {
    const namespace: Prisma.WikiPageWhereInput = { OR: [{ namespace: null }, { namespace: { not: "EventDescription" } }] };
    const revisions = await readMatchingCurrentWikiRevisions(context, query, wikiRevisionFields, namespace);
    const authoredWhere: Prisma.WikiPageWhereInput = MakeWhereCondition(wikiFields, query);
    const where = await GetAuthorizedTableReadWhere({
        table: xWikiPage, auth: context.authorization,
        where: { AND: [namespace, { OR: [authoredWhere, { id: { in: revisions.map(revision => revision.wikiPage.id) } }] }] }
    });
    const pages = await context.database.wikiPage.findMany({
        select: {
            id: true,
            publicId: true,
            slug: true
        },
        where,
        orderBy: { publicId: "asc" },
        take: candidatesPerType
    });
    const current = await readMatchingCurrentWikiRevisions(context, { ...query, keywords: [] }, wikiRevisionFields,
        { id: { in: pages.map(page => page.id) } });
    const currentByPage = new Map(current.map(revision => [revision.wikiPage.id, revision]));
    return pages.map((page): QuickSearchItemMatch<QuickSearchItemType.wikiPage> => {
        const revision = currentByPage.get(page.id);
        let match = CalculateMatchStrength(wikiFields, page, query);
        if (revision) {
            const revisionMatch = CalculateMatchStrength(wikiRevisionFields, revision, query);
            if (revisionMatch.matchStrength > match.matchStrength) {
                match = revisionMatch;
            }
        }
        return {
            id: xWikiPage.parseIdentity(page.publicId), itemType: QuickSearchItemType.wikiPage,
            name: revision ? `${revision.name} (${page.slug})` : page.slug, canonicalWikiSlug: page.slug,
            // lsmb todo: use a robust routing mechanism to generate URLs
            absoluteUri: contextualUri(`/backstage/wiki/${page.slug}`, input),
            matchStrength: match.matchStrength, matchingField: match.fieldName
        };
    });
}

async function readInstrumentMatches(context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput) {
    // Resolved catalogs already load their small band snapshot. Rank authorized display fields,
    // including Markdown descriptions, before applying the reference candidate limit.
    const result = await queryView({
        bandPublicId: input.bandPublicId,
        routeLocale: input.routeLocale,
        browserLanguages: input.browserLanguages,
        view: instrumentDashboardView,
        filter: {},
        orderBy: { publicId: "asc" },
        cmdbQueryContext: "quick search instruments",
    }, context.authorization, context);
    return result.items.map((instrument): QuickSearchItemMatch<QuickSearchItemType.instrument> => {
        const match = CalculateMatchStrength(instrumentFields, instrument, query);
        return {
            id: instrument.publicId,
            itemType: QuickSearchItemType.instrument,
            name: instrument.name ?? "",
            // lsmb todo: use a robust routing mechanism to generate URLs
            absoluteUri: contextualUri(`/backstage/instrument/${instrument.publicId}`, input),
            matchStrength: match.matchStrength,
            matchingField: match.fieldName
        };
    }).filter(match => match.matchStrength > 0).slice(0, candidatesPerType);
}

async function readPersonMatches(context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput) {
    // Shared person policy owns account visibility; the existing reference contract owns band eligibility.
    const authoredWhere: Prisma.UserWhereInput = MakeWhereCondition(personFields, query);
    const where = await GetAuthorizedTableReadWhere({
        table: xUser,
        auth: context.authorization,
        where: {
            AND: [
                activeBandPersonWhere(context.authorization.requireBand().id),
                authoredWhere
            ]
        }
    });

    const people = await context.database.user.findMany({
        select: {
            publicId: true,
            name: true
        },
        where,
        orderBy: { publicId: "asc" },
        take: candidatesPerType
    });
    return people.map((person): QuickSearchItemMatch<QuickSearchItemType.user> => {
        const match = CalculateMatchStrength(personFields, person, query);
        return {
            id: xUser.parseIdentity(person.publicId),
            itemType: QuickSearchItemType.user,
            name: person.name,
            // lsmb todo: use a robust routing mechanism to generate URLs
            absoluteUri: contextualUri(`/backstage/user/${person.publicId}`, input),
            matchStrength: match.matchStrength,
            matchingField: match.fieldName
        };
    });
}

interface QuickSearchPlugin {
    readonly aliases: readonly string[];
    readonly permission: Permission;
    readonly entity: xTable;
    readonly read: (context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput) => Promise<QuickSearchItemMatch[]>;
}
const plugins: { readonly [Type in QuickSearchItemType]: QuickSearchPlugin } = {
    song: {
        aliases: ["song", "s"],
        permission: Permission.view_songs,
        entity: xSong,
        read: readSongMatches
    },
    event: {
        aliases: ["event", "e"],
        permission: Permission.view_events,
        entity: xEvent,
        read: readEventMatches
    },
    instrument: {
        aliases: ["instrument", "i"],
        permission: Permission.login,
        entity: instrumentDashboardView.entity,
        read: readInstrumentMatches
    },
    wikiPage: {
        aliases: ["wikipage", "w"],
        permission: Permission.search_wiki_pages,
        entity: xWikiPage,
        read: readWikiMatches
    },
    user: { aliases: ["user", "u"], permission: Permission.search_users, entity: xUser, read: readPersonMatches },
};

async function parseBandSearchQuery(context: DB3ReadContext, keyword: string): Promise<ParseQuickFilterResult> {
    const query = ParseQuickFilter(keyword);
    if (!query.dateRange) {
        return query;
    }
    // The legacy parser produces calendar fields in local Dates; searches use the band's calendar.
    const calendarDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const timeZone = await loadBandTimeZone(context.database, context.authorization.requireBand().id);
    const window = getCalendarWindow({
        startDate: calendarDate(query.dateRange.start),
        endDateExclusive: calendarDate(query.dateRange.end)
    }, timeZone);
    return {
        ...query,
        dateRange: {
            start: new Date(window.startInstant),
            end: new Date(window.endInstantExclusive)
        }
    };
}

export async function getQuickSearchResults(input: QuickSearchInput, authorization: CMServerAuthorization,
    database: DB3ReadDatabase = db,
): Promise<QuickSearchItemMatch[]> {
    const args = QuickSearchInputSchema.parse(input);
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization.requireUser();
        auth.requirePermission(Permission.login);
        if (auth.requireBand().publicId !== args.bandPublicId) {
            throw new AuthorizationError("Search requires the selected band.");
        }
        const query = await parseBandSearchQuery(context, args.keyword);
        if (query.keywords.length === 0) {
            return [];
        }
        const selected = [...new Set(args.allowedItemTypes)].flatMap(type => {
            const plugin = plugins[type];
            if (!plugin || (query.typeFilter && !plugin.aliases.includes(query.typeFilter))) {
                return [];
            }
            // The caller chooses failure reporting; every plugin still enforces its shared read policy.
            if (args.permissionPolicy === "requireAll") {
                auth.requirePermission(plugin.permission);
                if (!plugin.entity.authorizeTableForView(auth)) {
                    throw new AuthorizationError("Not authorized to search this domain.");
                }
            }
            return auth.hasPermission(plugin.permission) && plugin.entity.authorizeTableForView(auth) ? [plugin] : [];
        });
        const matches = (await Promise.all(selected.map(plugin => plugin.read(context, query, args)))).flat();
        return matches.filter(match => match.matchStrength > 0)
            .sort((left, right) => right.matchStrength - left.matchStrength)
            .slice(0, resultsToReturn);
    });
}

// MIGRATION_RESTORE: quick-search
// Source: 66c5806d6f87b328a8ce0dbd653deb5bbacc3457:src/core/db3/server/quickSearchServerCore.ts:1-449
// Reason: Quick search uses unscoped global account/content readers, removed Instrument/tag relations and untranslated catalogs; association and Markdown suggestion callers do not supply a band.
// Restore: Restore authorized band-scoped HTTP search, domain plugins and query grammar/relevance, public identities and context-preserving links, association/song pickers, Markdown wiki/mention suggestions and the protected explorer; retain existing values, manual text/link editing and separate domain search.
// Verification: Test public/member/administrator privacy, two bands and locales, hidden/deleted/merged accounts and resources, localized/inherited catalogs, all-tag and type filters, ranking/limits, stale query/band responses, selection/clearing/keyboard behavior, song detail loading and Markdown suggestions in the built browser.
// SHA256: 139be87e031133fb6b7cc86253f7782207c4299d58bda20b22fbdcb00593d5f7
// MIGRATION_REFERENCE_BEGIN
// // consider unifying with the normal search api for consistency and simplicity.
//
// import { Permission } from "@/shared/permissions";
// import { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
// import { PermissionSet } from "@/src/auth/shared/PermissionSet";
// import { GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression } from "@/src/core/db3/server/db3Helpers";
// import { ServerApi } from "@/src/server/serverApi";
// import db from "db";
// import { toSorted } from "shared/arrayUtils";
// import { CalculateMatchStrength, CalculateMatchStrengthForTags, MakeWhereCondition, MakeWhereConditionForTags, ParseQuickFilter, ParseQuickFilterResult, QuickSearchItemMatch, QuickSearchItemType, SearchableTableFieldSpec } from "shared/quickFilter";
// import { slugify } from "shared/rootroot";
// import { IsNullOrWhitespace } from "shared/utils";
// import { xEvent } from "../shared/schema/event";
// import { xInstrument } from "../shared/schema/instrument";
// import { xSong } from "../shared/schema/song";
// import { xUser } from "../shared/schema/user";
// import { xWikiPage } from "../shared/schema/wiki";
//
// // per type; this is not the amount to return to users. after this, relevance prunes to the top N results.
// // this just sets a practical limit.
// const kItemsPerType = 100;
//
// interface QuickSearchPlugin<TItemType extends QuickSearchItemType> {
//     // return true if this plugin can handle the type of item.
//     matchesTypeFilter: (type: string) => boolean;
//     getMatches: (args: {
//         //user: UserWithRolesPayload,
//         //permissionSet: Readonly<PermissionSet>,
//         query: ParseQuickFilterResult,
//         auth: CMServerAuthorization,
//         //publicRole: Prisma.RoleGetPayload<{ include: { permissions: true } }>
//     }) => Promise<QuickSearchItemMatch<TItemType>[]>;
// };
//
// const IsAuthorized = (permissionSet: Readonly<PermissionSet>, permission: Permission): boolean => {
//     return permission !== Permission.never_grant && permissionSet.includesName(permission);
// };
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////
// const InstrumentQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.instrument> = {
//     matchesTypeFilter: (type: string) => type === QuickSearchItemType.instrument || type === "i",
//     getMatches: async ({ query, auth }) => {
//         if (!auth.hasPermission(Permission.login)) return [];
//
//         const instrumentFields: SearchableTableFieldSpec[] = [
//             { fieldName: "publicId", fieldType: "string", strengthMultiplier: 1 },
//             { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
//             { fieldName: "description", fieldType: "string", strengthMultiplier: 0.5 },
//         ];
//         const instruments = await db.instrument.findMany({
//             where: MakeWhereCondition(instrumentFields, query),
//             select: { publicId: true, name: true, description: true },
//             take: kItemsPerType,
//         });
//
//         return instruments.map(instrument => {
//             const bestMatch = CalculateMatchStrength(instrumentFields, instrument, query);
//             return {
//                 id: xInstrument.parseIdentity(instrument.publicId),
//                 absoluteUri: ServerApi.getAbsoluteUri(`/backstage/instrument/${instrument.publicId}`),
//                 name: instrument.name,
//                 matchStrength: bestMatch.matchStrength,
//                 matchingField: bestMatch.fieldName,
//                 itemType: QuickSearchItemType.instrument,
//             };
//         });
//     },
// };
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////
// const SongQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.song> = {
//     matchesTypeFilter: (type: string) => type === QuickSearchItemType.song || type == "s",
//     getMatches: async ({ query, auth }) => {
//         const songFields: SearchableTableFieldSpec[] = [
//             { fieldName: "id", fieldType: "pk", strengthMultiplier: 1 },
//             { fieldName: "aliases", fieldType: "string", strengthMultiplier: 0.7 },
//             { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
//             { fieldName: "description", fieldType: "string", strengthMultiplier: 0.5 },
//         ];
//
//         if (!auth.hasPermission(Permission.view_songs)) {
//             return [];
//         }
//
//         const songTagField: SearchableTableFieldSpec = { fieldName: "text", fieldType: "string", strengthMultiplier: 1 };
//
//         const songArgs = {
//             where: {
//                 AND: [
//                     GetSoftDeleteWhereExpression(),
//                     GetUserVisibilityWhereExpression({
//                         createdByUserIDColumnName: "createdByUserId",
//                         auth,
//                     }),
//                     {
//                         OR: [
//                             ...MakeWhereCondition(songFields, query).OR,
//                             {
//                                 tags: {
//                                     some: { // this doesn't quite work the way i wish; when trying to match multiple tags it will OR them. but "every" won't work either so... it's a compromise.
//                                         tag: MakeWhereConditionForTags(songTagField, query),
//                                     }
//                                 },
//                             }
//                         ]
//                     }
//                 ],
//             },
//             select: {
//                 id: true,
//                 publicId: true,
//                 introducedYear: true,
//                 name: true,
//                 aliases: true,
//                 description: true,
//                 tags: {
//                     select: {
//                         tag: {
//                             select: {
//                                 text: true,
//                             }
//                         }
//                     }
//                 }
//             },
//             take: kItemsPerType,
//         };
//
//         let songs = await db.song.findMany(songArgs);
//
//         // filter items:
//         // keep only items that contain ALL tags the user is requesting. this would be a decent reason to migrate to using similar system to the more detailed search.
//         if (query.tags.length > 0) {
//             const queryableTagNames = query.tags.map(t => t.toLowerCase());
//             songs = songs.filter(s => {
//                 const tagNames = s.tags.map(st => st.tag.text.toLowerCase()); // array of tag names.
//                 // return true if all queryable tags are represented in tagNames. that means at least 1 tagName must contain the queryable tag text.
//                 return queryableTagNames.every(qt => tagNames.some(tn => tn.includes(qt)));
//             });
//         }
//
//         const makeSongInfo = (x: typeof songs[0]): QuickSearchItemMatch<QuickSearchItemType.song> => {
//             const publicId = xSong.parseIdentity(x.publicId);
//             const absoluteUri = ServerApi.getAbsoluteUri(`/backstage/song/${publicId}/${slugify(x.name || "")}`);
//             let bestMatch = CalculateMatchStrength(songFields, x, query);
//
//             const bestMatchForTags = CalculateMatchStrengthForTags(songTagField, x.tags.map(st => st.tag), query);
//             if (bestMatchForTags.matchStrength > bestMatch.matchStrength) {
//                 bestMatch = bestMatchForTags;
//             }
//
//             return {
//                 id: publicId,
//                 absoluteUri,
//                 name: `${x.name}${x.introducedYear ? ` (${x.introducedYear})` : ""}`,
//                 matchStrength: bestMatch.matchStrength,
//                 matchingField: bestMatch.fieldName,
//                 itemType: QuickSearchItemType.song,
//             };
//         };
//
//         return songs.map(makeSongInfo);
//     },
// };
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////
// const EventQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.event> = {
//     matchesTypeFilter: (type: string) => type === QuickSearchItemType.event || type == "e",
//     getMatches: async ({ query, auth }) => {
//
//         if (!auth.hasPermission(Permission.view_events)) {
//             return [];
//         }
//
//         const eventFields: SearchableTableFieldSpec[] = [
//             { fieldName: "publicId", fieldType: "string", strengthMultiplier: 1 },
//             { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
//             { fieldName: "locationDescription", fieldType: "string", strengthMultiplier: 0.5 },
//             { fieldName: "startsAt", fieldType: "date", strengthMultiplier: 1 },
//         ];
//
//         const eventDescriptionFields: SearchableTableFieldSpec[] = [
//             { fieldName: "content", fieldType: "string", strengthMultiplier: 1 },
//         ];
//
//         const eventTagField: SearchableTableFieldSpec = { fieldName: "text", fieldType: "string", strengthMultiplier: 1 };
//
//         let events = await db.event.findMany({
//             where: {
//                 AND: [
//                     GetSoftDeleteWhereExpression(),
//                     GetUserVisibilityWhereExpression({
//                         auth,
//                         createdByUserIDColumnName: "createdByUserId",
//                     }),
//                     {
//                         OR: [
//                             ...MakeWhereCondition(eventFields, query).OR,
//                             {
//                                 descriptionWikiPage: {
//                                     currentRevision: MakeWhereCondition(eventDescriptionFields, query),
//                                 }
//                             },
//                             {
//                                 tags: {
//                                     some: { // this doesn't quite work the way i wish; when trying to match multiple tags it will OR them. but "every" won't work either so... it's a compromise.
//                                         eventTag: MakeWhereConditionForTags(eventTagField, query),
//                                     }
//                                 },
//                             }
//                         ]
//                     }
//                 ],
//             },
//             select: {
//                 publicId: true,
//                 name: true,
//                 startsAt: true,
//                 locationDescription: true,
//                 descriptionWikiPage: {
//                     select: {
//                         currentRevision: {
//                             select: {
//                                 content: true,
//                             }
//                         }
//                     }
//                 },
//                 tags: {
//                     select: {
//                         eventTag: {
//                             select: {
//                                 text: true,
//                             }
//                         }
//                     }
//                 }
//             },
//             orderBy: {
//                 startsAt: "asc", // simple way of trying to keep most relevant in the results
//             },
//             take: kItemsPerType,
//         });
//
//         // filter items:
//         if (query.tags.length > 0) {
//             const queryableTagNames = query.tags.map(t => t.toLowerCase());
//             events = events.filter(s => {
//                 const tagNames = s.tags.map(st => st.eventTag.text.toLowerCase()); // array of tag names.
//                 // return true if all queryable tags are represented in tagNames. that means at least 1 tagName must contain the queryable tag text.
//                 return queryableTagNames.every(qt => tagNames.some(tn => tn.includes(qt)));
//             });
//         }
//         const makeEventInfo = (x: typeof events[0]): QuickSearchItemMatch<QuickSearchItemType.event> => {
//             const absoluteUri = ServerApi.getAbsoluteUri(`/backstage/event/${x.publicId}/${slugify(x.name || "")}`);
//
//             let bestMatch = CalculateMatchStrength(eventFields, x, query);
//
//             if (!IsNullOrWhitespace(x.descriptionWikiPage?.currentRevision?.content)) {
//                 const bestMatchForRevision = CalculateMatchStrength(eventDescriptionFields, x.descriptionWikiPage!.currentRevision!, query);
//                 if (bestMatchForRevision.matchStrength > bestMatch.matchStrength) {
//                     bestMatch = bestMatchForRevision;
//                 }
//             }
//
//             const bestMatchForTags = CalculateMatchStrengthForTags(eventTagField, x.tags.map(st => st.eventTag), query);
//             if (bestMatchForTags.matchStrength > bestMatch.matchStrength) {
//                 bestMatch = bestMatchForTags;
//             }
//
//             return {
//                 absoluteUri,
//                 name: `${x.name}${x.startsAt ? ` (${x.startsAt.toLocaleDateString()})` : ""}`,
//                 id: xEvent.parseIdentity(x.publicId),
//                 matchStrength: bestMatch.matchStrength,
//                 matchingField: bestMatch.fieldName,
//                 itemType: QuickSearchItemType.event,
//             };
//         };
//
//         return events.map(makeEventInfo);
//     },
// };
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////
// const UserQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.user> = {
//     matchesTypeFilter: (type: string) => type === QuickSearchItemType.user || type == "u",
//     getMatches: async ({ query, auth }) => {
//
//         if (!auth.hasPermission(Permission.search_users)) {
//             return [];
//         }
//
//         const userFields: SearchableTableFieldSpec[] = [
//             { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
//         ];
//
//         const users = await db.user.findMany({
//             where: {
//                 AND: [
//                     GetSoftDeleteWhereExpression(),
//                     MakeWhereCondition(userFields, query),
//                 ],
//             },
//             select: {
//                 publicId: true,
//                 name: true,
//             },
//             take: kItemsPerType,
//         });
//
//         const makeUserInfo = (x: typeof users[0]): QuickSearchItemMatch<QuickSearchItemType.user> => {
//             const bestMatch = CalculateMatchStrength(userFields, x, query);
//             return {
//                 id: xUser.parseIdentity(x.publicId),
//                 absoluteUri: undefined,
//                 name: x.name,
//                 matchStrength: bestMatch.matchStrength,
//                 matchingField: bestMatch.fieldName,
//                 itemType: QuickSearchItemType.user,
//             };
//         };
//
//         return users.map(makeUserInfo);
//     },
// };
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////
// const WikiPageQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.wikiPage> = {
//     matchesTypeFilter: (type: string) => type === QuickSearchItemType.wikiPage || type == "w",
//     getMatches: async ({ query, auth }) => {
//
//         if (!auth.hasPermission(Permission.search_wiki_pages)) {
//             return [];
//         }
//
//         const wikiPageFields: SearchableTableFieldSpec[] = [
//             { fieldName: "slug", fieldType: "string", strengthMultiplier: 1 },
//         ];
//
//         const wikiPageRevisionFields: SearchableTableFieldSpec[] = [
//             { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
//             { fieldName: "content", fieldType: "string", strengthMultiplier: 0.5 },
//         ];
//
//         const wikiArgs = {
//             where: {
//                 AND: [
//                     {
//                         OR: [
//                             { namespace: { not: "EventDescription" } },
//                             { namespace: null },
//                         ]
//                     },
//                     GetUserVisibilityWhereExpression({
//                         auth,
//                         createdByUserIDColumnName: "createdByUserId",
//                     }),
//                     {
//                         OR: [
//                             ...MakeWhereCondition(wikiPageFields, query).OR,
//                             {
//                                 currentRevision: MakeWhereCondition(wikiPageRevisionFields, query),
//                             }
//                         ]
//                     }
//                 ]
//             },
//             select: {
//                 publicId: true,
//                 slug: true,
//                 currentRevision: {
//                     select: {
//                         name: true,
//                         content: true,
//                     }
//                 },
//             },
//             take: kItemsPerType,
//         };
//
//         //debugger;
//
//         const wikiPages = await db.wikiPage.findMany(wikiArgs);
//
//         const makeWikiPageInfo = (x: typeof wikiPages[0]): QuickSearchItemMatch<QuickSearchItemType.wikiPage> => {
//             const absoluteUri = ServerApi.getAbsoluteUri(`/backstage/wiki/${x.slug}`); //
//             let bestMatch = CalculateMatchStrength(wikiPageFields, x, query);
//             if (x.currentRevision) {
//                 const bestMatchForRevision = CalculateMatchStrength(wikiPageRevisionFields, x.currentRevision, query);
//                 if (bestMatchForRevision.matchStrength > bestMatch.matchStrength) {
//                     bestMatch = bestMatchForRevision;
//                 }
//             }
//
//             return {
//                 id: xWikiPage.parseIdentity(x.publicId),
//                 absoluteUri,
//                 name: x.currentRevision ? `${x.currentRevision.name} (${x.slug})` : x.slug,
//                 canonicalWikiSlug: x.slug,
//                 matchStrength: bestMatch.matchStrength,
//                 matchingField: bestMatch.fieldName,
//                 itemType: QuickSearchItemType.wikiPage,
//             };
//         };
//
//         return wikiPages.map(makeWikiPageInfo);
//     },
// };
//
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////
// export async function getQuickSearchResults(keyword__: string, auth: CMServerAuthorization, allowedItemTypes: QuickSearchItemType[]): Promise<QuickSearchItemMatch[]> {
//
//     //const publicRole = await GetPublicRole();
//     //const permissionSet = await loadEffectivePermissions(db, user);
//     const query = ParseQuickFilter(keyword__);
//     const itemsToReturn = 15;
//
//     const plugins: { [TItemType in QuickSearchItemType]: QuickSearchPlugin<TItemType> } = {
//         [QuickSearchItemType.song]: SongQuickSearchPlugin,
//         [QuickSearchItemType.event]: EventQuickSearchPlugin,
//         [QuickSearchItemType.instrument]: InstrumentQuickSearchPlugin,
//         [QuickSearchItemType.user]: UserQuickSearchPlugin,
//         [QuickSearchItemType.wikiPage]: WikiPageQuickSearchPlugin,
//     };
//
//     const pluginsToUse = allowedItemTypes
//         .map(type => plugins[type])
//         .filter(plugin => plugin !== undefined)
//         .filter(plugin => !query.typeFilter || plugin.matchesTypeFilter(query.typeFilter));
//
//     let allCalls = pluginsToUse.map(plugin => plugin.getMatches({
//         query,
//         auth,
//     }));
//     let ret = (await Promise.all(allCalls))
//         .flat(1)
//         .filter(s => s.matchStrength > 0);
//
//     ret = toSorted(ret, (a, b) => b.matchStrength - a.matchStrength);
//     ret = ret.slice(0, itemsToReturn);
//     return ret;
// }
// MIGRATION_REFERENCE_END
