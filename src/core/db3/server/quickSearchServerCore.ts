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
import { SearchCatalogs } from "./searchCatalogs";
import { readQuickSearchTags, quickSearchTagStrength } from "./quickSearchTags";

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

async function readSongMatches(context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput, catalogs: SearchCatalogs) {
    const tags = await readQuickSearchTags(xSong, xSong.fields.tags, query, catalogs);
    const tagConditions: Prisma.SongWhereInput[] = tags.publicIdsByToken.map(publicIds => ({
        tags: { some: { tag: { publicId: { in: publicIds } } } },
    }));
    const authoredWhere: Prisma.SongWhereInput = MakeWhereCondition(songFields, query);
    // The reference #tag grammar requires every tag; authored words contribute ranking.
    const where = await GetAuthorizedTableReadWhere({ table: xSong, auth: context.authorization,
        where: tagConditions.length ? { AND: tagConditions } : authoredWhere });
    const songs = await context.database.song.findMany({
        where,
        select: {
            publicId: true,
            name: true,
            aliases: true,
            description: true,
            introducedYear: true,
            tags: { select: { tag: { select: { publicId: true } } } },
        },
        orderBy: { publicId: "asc" }, take: candidatesPerType,
    });
    return songs.map((song): QuickSearchItemMatch<QuickSearchItemType.song> => {
        let match = CalculateMatchStrength(songFields, song, query);
        const tagMatch = quickSearchTagStrength(song.tags.map(row => row.tag.publicId), tags, query);
        if (tagMatch.matchStrength > match.matchStrength) {
            match = tagMatch;
        }
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

async function readEventMatches(context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput, catalogs: SearchCatalogs) {
    const auth = context.authorization;
    const tags = await readQuickSearchTags(xEvent, xEvent.fields.tags, query, catalogs);
    const tagConditions: Prisma.EventWhereInput[] = tags.publicIdsByToken.map(publicIds => ({
        tags: { some: { eventTag: { publicId: { in: publicIds } } } },
    }));
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
            descriptionWikiPageId: true,
            tags: { select: { eventTag: { select: { publicId: true } } } },
        },
        where: {
            AND: [
                eventPolicy,
                tagConditions.length ? { AND: tagConditions } : {
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
        const tagMatch = quickSearchTagStrength(event.tags.map(row => row.eventTag.publicId), tags, query);
        if (tagMatch.matchStrength > match.matchStrength) {
            match = tagMatch;
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
    readonly read: (context: DB3ReadContext, query: ParseQuickFilterResult, input: QuickSearchInput, catalogs: SearchCatalogs) => Promise<QuickSearchItemMatch[]>;
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
        if (query.keywords.length === 0 && query.tags.length === 0) {
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
        const catalogs = new SearchCatalogs(context, args);
        const matches = (await Promise.all(selected.map(plugin => plugin.read(context, query, args, catalogs)))).flat();
        return matches.filter(match => match.matchStrength > 0)
            .sort((left, right) => right.matchStrength - left.matchStrength)
            .slice(0, resultsToReturn);
    });
}
