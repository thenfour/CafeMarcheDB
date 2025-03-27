// consider unifying with the normal search api for consistency and simplicity.

import { Ctx } from "@blitzjs/next";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { toSorted } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { CalculateMatchStrength, MakeWhereCondition, ParseQuickFilter, QuickSearchItemMatch, SearchableTableFieldSpec } from "shared/quickFilter";
import { slugify } from "shared/rootroot";
import { api } from "src/blitz-server";
import * as db3 from "src/core/db3/db3";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { GetPublicRole, GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression2 } from "src/core/db3/shared/db3Helpers";

async function getQuickSearchResults(keyword__: string, user: db3.UserWithRolesPayload): Promise<QuickSearchItemMatch[]> {

    const publicRole = await GetPublicRole();
    const query = ParseQuickFilter(keyword__);
    const itemsPerType = 15;
    const itemsToReturn = 15;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////
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
        take: itemsPerType,
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
            itemType: "song",
        };
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////
    const eventFields: SearchableTableFieldSpec[] = [
        { fieldName: "id", fieldType: "pk", strengthMultiplier: 1 },
        { fieldName: "name", fieldType: "string", strengthMultiplier: 1 },
        { fieldName: "locationDescription", fieldType: "string", strengthMultiplier: 0.5 },
        { fieldName: "startsAt", fieldType: "date", strengthMultiplier: 1 },
    ];

    const events = await db.event.findMany({
        where: {
            AND: [
                GetSoftDeleteWhereExpression(),
                GetUserVisibilityWhereExpression2({ user, userRole: user.role, publicRole }),
                MakeWhereCondition(eventFields, query),
            ],
        },
        select: {
            id: true,
            name: true,
            startsAt: true,
            locationDescription: true,
        },
        orderBy: {
            startsAt: "asc",
        },
        take: itemsPerType,
    });

    const makeEventInfo = (x: typeof events[0]): QuickSearchItemMatch => {
        const absoluteUri = process.env.CMDB_BASE_URL + `backstage/event/${x.id}/${slugify(x.name || "")}`;

        const bestMatch = CalculateMatchStrength(eventFields, x, query);

        return {
            absoluteUri,
            name: `${x.name}${x.startsAt ? ` (${x.startsAt.toLocaleDateString()})` : ""}`,
            id: x.id,
            matchStrength: bestMatch.matchStrength,
            matchingField: bestMatch.fieldName,
            itemType: "event",
        };
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////
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
        take: itemsPerType,
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
            itemType: "wikiPage",
        };
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////
    // const makeUserInfo = (x: typeof userSlugs[0]): QuickSearchItemMatch => {
    //     return {
    //         id: x.id,
    //         name: x.name,
    //         itemType: "user",
    //         absoluteUri: undefined,
    //     };
    // };

    // const makeInstrumentInfo = (x: typeof instrumentSlugs[0]): QuickSearchItemMatch => {
    //     return {
    //         id: x.id,
    //         name: x.name,
    //         itemType: "instrument",
    //         absoluteUri: undefined,
    //     };
    // };

    let ret: QuickSearchItemMatch[] = [
        ...songs.map(s => makeSongInfo(s)).filter(s => s.matchStrength > 0),
        ...events.map(s => makeEventInfo(s)).filter(s => s.matchStrength > 0),
        ...wikiPages.map(s => makeWikiPageInfo(s)).filter(s => s.matchStrength > 0),
    ];

    ret = toSorted(ret, (a, b) => b.matchStrength - a.matchStrength);
    ret = ret.slice(0, itemsToReturn);
    return ret;
}





export default api(async (req, res, origCtx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        origCtx.session.$authorize(Permission.visibility_public);
        const ctx: AuthenticatedCtx = origCtx as any; // authorize ensures this.
        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
        if (!currentUser) throw new Error(`not authorized`);

        const { keyword } = req.query;

        if (typeof keyword !== "string") {
            res.status(400).json({ error: "A valid keyword must be provided" });
            return;
        }

        try {
            const slugs = await getQuickSearchResults(keyword, currentUser);
            res.status(200).json(slugs);
        } catch (error) {
            console.error("Failed to fetch slugs", error);
            res.status(500).json({ error: "Failed to fetch data" });
        }
    }); // return new promise
});





