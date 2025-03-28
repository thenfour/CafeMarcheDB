// consider unifying with the normal search api for consistency and simplicity.

import db, { Prisma } from "db";
import { toSorted } from "shared/arrayUtils";
import { CalculateMatchStrength, MakeWhereCondition, ParseQuickFilter, ParseQuickFilterResult, QuickSearchItemMatch, QuickSearchItemType, SearchableTableFieldSpec } from "shared/quickFilter";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { GetPublicRole, GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression2 } from "src/core/db3/shared/db3Helpers";


const kItemsPerType = 15;

interface QuickSearchPlugin {
    getMatches: (args: {
        user: db3.UserWithRolesPayload,
        query: ParseQuickFilterResult,
        publicRole: Prisma.RoleGetPayload<{ include: { permissions: true } }>
    }) => Promise<QuickSearchItemMatch[]>;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////
const SongQuickSearchPlugin: QuickSearchPlugin = {
    getMatches: async ({ user, query, publicRole }) => {
        const songFields: SearchableTableFieldSpec[] = [
            { fieldName: "id", fieldType: "pk", strengthMultiplier: 1 },
            { fieldName: "aliases", fieldType: "string", strengthMultiplier: 0.7 },
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "description", fieldType: "string", strengthMultiplier: 0.5 },
        ];

        const songs = await db.song.findMany({
            where: {
                AND: [
                    GetSoftDeleteWhereExpression(),
                    GetUserVisibilityWhereExpression2({ user, userRole: user.role, publicRole }),
                    MakeWhereCondition(songFields, query),
                ],
            },
            select: {
                id: true,
                introducedYear: true,
                name: true,
                aliases: true,
                description: true,
            },
            take: kItemsPerType,
        });

        const makeSongInfo = (x: typeof songs[0]): QuickSearchItemMatch => {
            const absoluteUri = process.env.CMDB_BASE_URL + `backstage/song/${x.id}/${slugify(x.name || "")}`;
            const bestMatch = CalculateMatchStrength(songFields, x, query);
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
const EventQuickSearchPlugin: QuickSearchPlugin = {
    getMatches: async ({ user, query, publicRole }) => {

        const eventFields: SearchableTableFieldSpec[] = [
            { fieldName: "id", fieldType: "pk", strengthMultiplier: 1 },
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "locationDescription", fieldType: "string", strengthMultiplier: 0.5 },
            { fieldName: "startsAt", fieldType: "date", strengthMultiplier: 1 },
        ];

        const eventDescriptionFields: SearchableTableFieldSpec[] = [
            { fieldName: "content", fieldType: "string", strengthMultiplier: 1 },
        ];

        const events = await db.event.findMany({
            where: {
                AND: [
                    GetSoftDeleteWhereExpression(),
                    GetUserVisibilityWhereExpression2({ user, userRole: user.role, publicRole }),
                    {
                        OR: [
                            ...MakeWhereCondition(eventFields, query).OR,
                            {
                                descriptionWikiPage: {
                                    currentRevision: MakeWhereCondition(eventDescriptionFields, query),
                                }
                            }
                        ]
                    }
                ],
            },
            select: {
                id: true,
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
            },
            orderBy: {
                startsAt: "asc",
            },
            take: kItemsPerType,
        });

        const makeEventInfo = (x: typeof events[0]): QuickSearchItemMatch => {
            const absoluteUri = process.env.CMDB_BASE_URL + `backstage/event/${x.id}/${slugify(x.name || "")}`;

            let bestMatch = CalculateMatchStrength(eventFields, x, query);
            if (!IsNullOrWhitespace(x.descriptionWikiPage?.currentRevision?.content)) {
                const bestMatchForRevision = CalculateMatchStrength(eventDescriptionFields, x.descriptionWikiPage!.currentRevision!, query);
                if (bestMatchForRevision.matchStrength > bestMatch.matchStrength) {
                    bestMatch = bestMatchForRevision;
                }
            }

            return {
                absoluteUri,
                name: `${x.name}${x.startsAt ? ` (${x.startsAt.toLocaleDateString()})` : ""}`,
                id: x.id,
                matchStrength: bestMatch.matchStrength,
                matchingField: bestMatch.fieldName,
                itemType: QuickSearchItemType.event,
            };
        };

        return events.map(makeEventInfo);
    },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////
const UserQuickSearchPlugin: QuickSearchPlugin = {
    getMatches: async ({ user, query, publicRole }) => {
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

        const makeUserInfo = (x: typeof users[0]): QuickSearchItemMatch => {
            //const absoluteUri = process.env.CMDB_BASE_URL + `backstage/song/${x.id}/${slugify(x.name || "")}`;
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
const WikiPageQuickSearchPlugin: QuickSearchPlugin = {
    getMatches: async ({ user, query, publicRole }) => {
        const wikiPageFields: SearchableTableFieldSpec[] = [
            { fieldName: "slug", fieldType: "string", strengthMultiplier: 1 },
        ];

        const wikiPageRevisionFields: SearchableTableFieldSpec[] = [
            { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
            { fieldName: "content", fieldType: "string", strengthMultiplier: 0.5 },
        ];

        const wikiPages = await db.wikiPage.findMany({
            where: {
                AND: [
                    { namespace: { not: "EventDescription" } },
                    GetUserVisibilityWhereExpression2({ user, userRole: user.role, publicRole }),
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
        });

        const makeWikiPageInfo = (x: typeof wikiPages[0]): QuickSearchItemMatch => {
            const absoluteUri = process.env.CMDB_BASE_URL + `backstage/wiki/${x.slug}`; // 
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
                matchStrength: bestMatch.matchStrength,
                matchingField: bestMatch.fieldName,
                itemType: QuickSearchItemType.wikiPage,
            };
        };

        return wikiPages.map(makeWikiPageInfo);
    },
};



////////////////////////////////////////////////////////////////////////////////////////////////////////
export async function getQuickSearchResults(keyword__: string, user: db3.UserWithRolesPayload, allowedItemTypes: QuickSearchItemType[]): Promise<QuickSearchItemMatch[]> {

    const publicRole = await GetPublicRole();
    const query = ParseQuickFilter(keyword__);
    const itemsToReturn = 15;

    const plugins: Record<QuickSearchItemType, QuickSearchPlugin> = {
        [QuickSearchItemType.song]: SongQuickSearchPlugin,
        [QuickSearchItemType.event]: EventQuickSearchPlugin,
        [QuickSearchItemType.user]: UserQuickSearchPlugin,
        [QuickSearchItemType.wikiPage]: WikiPageQuickSearchPlugin,
    } as const;

    const pluginsToUse = allowedItemTypes.map(type => plugins[type]).filter(plugin => plugin !== undefined);

    let allCalls = pluginsToUse.map(plugin => plugin.getMatches({ user, query, publicRole }));
    let ret = (await Promise.all(allCalls))
        .flat(1)
        .filter(s => s.matchStrength > 0);

    ret = toSorted(ret, (a, b) => b.matchStrength - a.matchStrength);
    ret = ret.slice(0, itemsToReturn);
    return ret;
}

