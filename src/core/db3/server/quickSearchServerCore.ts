// consider unifying with the normal search api for consistency and simplicity.

import { Permission } from "@/shared/permissions";
import { principalHasPermission } from "@/src/auth/server/permissionAuthorization";
import { ServerApi } from "@/src/server/serverApi";
import db, { Prisma } from "db";
import { toSorted } from "shared/arrayUtils";
import { CalculateMatchStrength, CalculateMatchStrengthForTags, MakeWhereCondition, MakeWhereConditionForTags, ParseQuickFilter, ParseQuickFilterResult, QuickSearchItemMatch, QuickSearchItemType, SearchableTableFieldSpec } from "shared/quickFilter";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace } from "shared/utils";
import { GetPublicRole, GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression2 } from "src/core/db3/shared/db3Helpers";
import { UserWithRolesPayload } from "../shared/schema/userPayloads";
import { loadEffectivePermissions } from "@/src/auth/server/effectivePermissions";
import { PermissionSet } from "@/src/auth/shared/PermissionSet";
import { xInstrument } from "../shared/schema/instrument";
import { xEvent } from "../shared/schema/event";

// per type; this is not the amount to return to users. after this, relevance prunes to the top N results.
// this just sets a practical limit.
const kItemsPerType = 100;

interface QuickSearchPlugin<TItemType extends QuickSearchItemType> {
    // return true if this plugin can handle the type of item.
    matchesTypeFilter: (type: string) => boolean;
    getMatches: (args: {
        user: UserWithRolesPayload,
        permissionSet: Readonly<PermissionSet>,
        query: ParseQuickFilterResult,
        publicRole: Prisma.RoleGetPayload<{ include: { permissions: true } }>
    }) => Promise<QuickSearchItemMatch<TItemType>[]>;
};

const IsAuthorized = (permissionSet: Readonly<PermissionSet>, permission: Permission): boolean => {
    return principalHasPermission(permissionSet, permission);
};


////////////////////////////////////////////////////////////////////////////////////////////////////////
const InstrumentQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.instrument> = {
    matchesTypeFilter: (type: string) => type === QuickSearchItemType.instrument || type === "i",
    getMatches: async ({ query, permissionSet }) => {
        if (!IsAuthorized(permissionSet, Permission.login)) return [];

        const instrumentFields: SearchableTableFieldSpec[] = [
            { fieldName: "publicId", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "description", fieldType: "string", strengthMultiplier: 0.5 },
        ];
        const instruments = await db.instrument.findMany({
            where: MakeWhereCondition(instrumentFields, query),
            select: { publicId: true, name: true, description: true },
            take: kItemsPerType,
        });

        return instruments.map(instrument => {
            const bestMatch = CalculateMatchStrength(instrumentFields, instrument, query);
            return {
                id: xInstrument.parseIdentity(instrument.publicId),
                absoluteUri: ServerApi.getAbsoluteUri(`/backstage/instrument/${instrument.publicId}`),
                name: instrument.name,
                matchStrength: bestMatch.matchStrength,
                matchingField: bestMatch.fieldName,
                itemType: QuickSearchItemType.instrument,
            };
        });
    },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////
const SongQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.song> = {
    matchesTypeFilter: (type: string) => type === QuickSearchItemType.song || type == "s",
    getMatches: async ({ user, query, publicRole, permissionSet }) => {
        const songFields: SearchableTableFieldSpec[] = [
            { fieldName: "id", fieldType: "pk", strengthMultiplier: 1 },
            { fieldName: "aliases", fieldType: "string", strengthMultiplier: 0.7 },
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "description", fieldType: "string", strengthMultiplier: 0.5 },
        ];

        if (!IsAuthorized(permissionSet, Permission.view_songs)) {
            return [];
        }

        const songTagField: SearchableTableFieldSpec = { fieldName: "text", fieldType: "string", strengthMultiplier: 1 };

        const songArgs = {
            where: {
                AND: [
                    GetSoftDeleteWhereExpression(),
                    GetUserVisibilityWhereExpression2({
                        user,
                        userRole: user.role,
                        publicRole,
                        createdByUserIDColumnName: "createdByUserId",
                    }),
                    {
                        OR: [
                            ...MakeWhereCondition(songFields, query).OR,
                            {
                                tags: {
                                    some: { // this doesn't quite work the way i wish; when trying to match multiple tags it will OR them. but "every" won't work either so... it's a compromise.
                                        tag: MakeWhereConditionForTags(songTagField, query),
                                    }
                                },
                            }
                        ]
                    }
                ],
            },
            select: {
                id: true,
                introducedYear: true,
                name: true,
                aliases: true,
                description: true,
                tags: {
                    select: {
                        tag: {
                            select: {
                                text: true,
                            }
                        }
                    }
                }
            },
            take: kItemsPerType,
        };

        let songs = await db.song.findMany(songArgs);

        // filter items:
        // keep only items that contain ALL tags the user is requesting. this would be a decent reason to migrate to using similar system to the more detailed search.
        if (query.tags.length > 0) {
            const queryableTagNames = query.tags.map(t => t.toLowerCase());
            songs = songs.filter(s => {
                const tagNames = s.tags.map(st => st.tag.text.toLowerCase()); // array of tag names.
                // return true if all queryable tags are represented in tagNames. that means at least 1 tagName must contain the queryable tag text.
                return queryableTagNames.every(qt => tagNames.some(tn => tn.includes(qt)));
            });
        }

        const makeSongInfo = (x: typeof songs[0]): QuickSearchItemMatch<QuickSearchItemType.song> => {
            const absoluteUri = ServerApi.getAbsoluteUri(`/backstage/song/${x.id}/${slugify(x.name || "")}`);
            let bestMatch = CalculateMatchStrength(songFields, x, query);

            const bestMatchForTags = CalculateMatchStrengthForTags(songTagField, x.tags.map(st => st.tag), query);
            if (bestMatchForTags.matchStrength > bestMatch.matchStrength) {
                bestMatch = bestMatchForTags;
            }

            return {
                id: x.id,
                absoluteUri,
                name: `${x.name}${x.introducedYear ? ` (${x.introducedYear})` : ""}`,
                matchStrength: bestMatch.matchStrength,
                matchingField: bestMatch.fieldName,
                itemType: QuickSearchItemType.song,
            };
        };

        return songs.map(makeSongInfo);
    },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////
const EventQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.event> = {
    matchesTypeFilter: (type: string) => type === QuickSearchItemType.event || type == "e",
    getMatches: async ({ user, query, publicRole, permissionSet }) => {

        if (!IsAuthorized(permissionSet, Permission.view_events)) {
            return [];
        }

        const eventFields: SearchableTableFieldSpec[] = [
            { fieldName: "publicId", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "locationDescription", fieldType: "string", strengthMultiplier: 0.5 },
            { fieldName: "startsAt", fieldType: "date", strengthMultiplier: 1 },
        ];

        const eventDescriptionFields: SearchableTableFieldSpec[] = [
            { fieldName: "content", fieldType: "string", strengthMultiplier: 1 },
        ];

        const eventTagField: SearchableTableFieldSpec = { fieldName: "text", fieldType: "string", strengthMultiplier: 1 };

        let events = await db.event.findMany({
            where: {
                AND: [
                    GetSoftDeleteWhereExpression(),
                    GetUserVisibilityWhereExpression2({
                        user,
                        userRole: user.role,
                        publicRole,
                        createdByUserIDColumnName: "createdByUserId",
                    }),
                    {
                        OR: [
                            ...MakeWhereCondition(eventFields, query).OR,
                            {
                                descriptionWikiPage: {
                                    currentRevision: MakeWhereCondition(eventDescriptionFields, query),
                                }
                            },
                            {
                                tags: {
                                    some: { // this doesn't quite work the way i wish; when trying to match multiple tags it will OR them. but "every" won't work either so... it's a compromise.
                                        eventTag: MakeWhereConditionForTags(eventTagField, query),
                                    }
                                },
                            }
                        ]
                    }
                ],
            },
            select: {
                publicId: true,
                name: true,
                startsAt: true,
                locationDescription: true,
                descriptionWikiPage: {
                    select: {
                        currentRevision: {
                            select: {
                                content: true,
                            }
                        }
                    }
                },
                tags: {
                    select: {
                        eventTag: {
                            select: {
                                text: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                startsAt: "asc", // simple way of trying to keep most relevant in the results
            },
            take: kItemsPerType,
        });

        // filter items:
        if (query.tags.length > 0) {
            const queryableTagNames = query.tags.map(t => t.toLowerCase());
            events = events.filter(s => {
                const tagNames = s.tags.map(st => st.eventTag.text.toLowerCase()); // array of tag names.
                // return true if all queryable tags are represented in tagNames. that means at least 1 tagName must contain the queryable tag text.
                return queryableTagNames.every(qt => tagNames.some(tn => tn.includes(qt)));
            });
        }
        const makeEventInfo = (x: typeof events[0]): QuickSearchItemMatch<QuickSearchItemType.event> => {
            const absoluteUri = ServerApi.getAbsoluteUri(`/backstage/event/${x.publicId}/${slugify(x.name || "")}`);

            let bestMatch = CalculateMatchStrength(eventFields, x, query);

            if (!IsNullOrWhitespace(x.descriptionWikiPage?.currentRevision?.content)) {
                const bestMatchForRevision = CalculateMatchStrength(eventDescriptionFields, x.descriptionWikiPage!.currentRevision!, query);
                if (bestMatchForRevision.matchStrength > bestMatch.matchStrength) {
                    bestMatch = bestMatchForRevision;
                }
            }

            const bestMatchForTags = CalculateMatchStrengthForTags(eventTagField, x.tags.map(st => st.eventTag), query);
            if (bestMatchForTags.matchStrength > bestMatch.matchStrength) {
                bestMatch = bestMatchForTags;
            }

            return {
                absoluteUri,
                name: `${x.name}${x.startsAt ? ` (${x.startsAt.toLocaleDateString()})` : ""}`,
                id: xEvent.parseIdentity(x.publicId),
                matchStrength: bestMatch.matchStrength,
                matchingField: bestMatch.fieldName,
                itemType: QuickSearchItemType.event,
            };
        };

        return events.map(makeEventInfo);
    },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////
const UserQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.user> = {
    matchesTypeFilter: (type: string) => type === QuickSearchItemType.user || type == "u",
    getMatches: async ({ user, query, publicRole, permissionSet }) => {

        if (!IsAuthorized(permissionSet, Permission.search_users)) {
            return [];
        }

        const userFields: SearchableTableFieldSpec[] = [
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
        ];

        const users = await db.user.findMany({
            where: {
                AND: [
                    GetSoftDeleteWhereExpression(),
                    MakeWhereCondition(userFields, query),
                ],
            },
            select: {
                id: true,
                name: true,
            },
            take: kItemsPerType,
        });

        const makeUserInfo = (x: typeof users[0]): QuickSearchItemMatch<QuickSearchItemType.user> => {
            const bestMatch = CalculateMatchStrength(userFields, x, query);
            return {
                id: x.id,
                absoluteUri: undefined,
                name: x.name,
                matchStrength: bestMatch.matchStrength,
                matchingField: bestMatch.fieldName,
                itemType: QuickSearchItemType.user,
            };
        };

        return users.map(makeUserInfo);
    },
};


////////////////////////////////////////////////////////////////////////////////////////////////////////
const WikiPageQuickSearchPlugin: QuickSearchPlugin<QuickSearchItemType.wikiPage> = {
    matchesTypeFilter: (type: string) => type === QuickSearchItemType.wikiPage || type == "w",
    getMatches: async ({ user, query, publicRole, permissionSet }) => {

        if (!IsAuthorized(permissionSet, Permission.search_wiki_pages)) {
            return [];
        }

        const wikiPageFields: SearchableTableFieldSpec[] = [
            { fieldName: "slug", fieldType: "string", strengthMultiplier: 1 },
        ];

        const wikiPageRevisionFields: SearchableTableFieldSpec[] = [
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "content", fieldType: "string", strengthMultiplier: 0.5 },
        ];

        const wikiArgs = {
            where: {
                AND: [
                    {
                        OR: [
                            { namespace: { not: "EventDescription" } },
                            { namespace: null },
                        ]
                    },
                    GetUserVisibilityWhereExpression2({
                        user,
                        userRole: user.role,
                        publicRole,
                        createdByUserIDColumnName: "createdByUserId",
                    }),
                    {
                        OR: [
                            ...MakeWhereCondition(wikiPageFields, query).OR,
                            {
                                currentRevision: MakeWhereCondition(wikiPageRevisionFields, query),
                            }
                        ]
                    }
                ]
            },
            select: {
                id: true,
                slug: true,
                currentRevision: {
                    select: {
                        name: true,
                        content: true,
                    }
                },
            },
            take: kItemsPerType,
        };

        //debugger;

        const wikiPages = await db.wikiPage.findMany(wikiArgs);

        const makeWikiPageInfo = (x: typeof wikiPages[0]): QuickSearchItemMatch<QuickSearchItemType.wikiPage> => {
            const absoluteUri = ServerApi.getAbsoluteUri(`/backstage/wiki/${x.slug}`); // 
            let bestMatch = CalculateMatchStrength(wikiPageFields, x, query);
            if (x.currentRevision) {
                const bestMatchForRevision = CalculateMatchStrength(wikiPageRevisionFields, x.currentRevision, query);
                if (bestMatchForRevision.matchStrength > bestMatch.matchStrength) {
                    bestMatch = bestMatchForRevision;
                }
            }

            return {
                id: x.id,
                absoluteUri,
                name: x.currentRevision ? `${x.currentRevision.name} (${x.slug})` : x.slug,
                canonicalWikiSlug: x.slug,
                matchStrength: bestMatch.matchStrength,
                matchingField: bestMatch.fieldName,
                itemType: QuickSearchItemType.wikiPage,
            };
        };

        return wikiPages.map(makeWikiPageInfo);
    },
};



////////////////////////////////////////////////////////////////////////////////////////////////////////
export async function getQuickSearchResults(keyword__: string, user: UserWithRolesPayload, allowedItemTypes: QuickSearchItemType[]): Promise<QuickSearchItemMatch[]> {

    const publicRole = await GetPublicRole();
    const permissionSet = await loadEffectivePermissions(db, user);
    const query = ParseQuickFilter(keyword__);
    const itemsToReturn = 15;

    const plugins: { [TItemType in QuickSearchItemType]: QuickSearchPlugin<TItemType> } = {
        [QuickSearchItemType.song]: SongQuickSearchPlugin,
        [QuickSearchItemType.event]: EventQuickSearchPlugin,
        [QuickSearchItemType.instrument]: InstrumentQuickSearchPlugin,
        [QuickSearchItemType.user]: UserQuickSearchPlugin,
        [QuickSearchItemType.wikiPage]: WikiPageQuickSearchPlugin,
    };

    const pluginsToUse = allowedItemTypes
        .map(type => plugins[type])
        .filter(plugin => plugin !== undefined)
        .filter(plugin => !query.typeFilter || plugin.matchesTypeFilter(query.typeFilter));

    let allCalls = pluginsToUse.map(plugin => plugin.getMatches({ user, query, publicRole, permissionSet }));
    let ret = (await Promise.all(allCalls))
        .flat(1)
        .filter(s => s.matchStrength > 0);

    ret = toSorted(ret, (a, b) => b.matchStrength - a.matchStrength);
    ret = ret.slice(0, itemsToReturn);
    return ret;
}

