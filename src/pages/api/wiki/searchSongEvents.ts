// consider unifying with the normal search api for consistency and simplicity.

import { Ctx } from "@blitzjs/next";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import { api } from "src/blitz-server";
import * as db3 from "src/core/db3/db3";
import { GetPublicRole, GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression2 } from "src/core/db3/shared/db3Helpers";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { MakeWhereCondition, ParseQuickFilter, QuickSearchItemMatch } from "shared/quickFilter";
import { toSorted } from "shared/arrayUtils";

async function getQuickSearchResults(keyword__: string, user: db3.UserWithRolesPayload): Promise<QuickSearchItemMatch[]> {

    const publicRole = await GetPublicRole();
    const query = ParseQuickFilter(keyword__);
    const itemsPerType = 5;
    const itemsToReturn = 15;

    const songs = await db.song.findMany({
        where: {
            AND: [
                GetSoftDeleteWhereExpression(),
                GetUserVisibilityWhereExpression2({ user, userRole: user.role, publicRole }),
                MakeWhereCondition([
                    { fieldName: "id", fieldType: "pk" },
                    { fieldName: "aliases", fieldType: "string" },
                    { fieldName: "name", fieldType: "string" },
                ], query),
            ],
        },
        select: {
            id: true,
            introducedYear: true,
            name: true,
            aliases: true,
        },
        take: itemsPerType,
    });

    const events = await db.event.findMany({
        where: {
            AND: [
                GetSoftDeleteWhereExpression(),
                GetUserVisibilityWhereExpression2({ user, userRole: user.role, publicRole }),
                MakeWhereCondition([
                    { fieldName: "id", fieldType: "pk" },
                    { fieldName: "name", fieldType: "string" },
                    { fieldName: "locationDescription", fieldType: "string" },
                    { fieldName: "startsAt", fieldType: "date" },
                ], query),
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

    const wikiPages = await db.wikiPage.findMany({
        where: {
            AND: [
                { namespace: { not: "EventDescription" } },
                GetUserVisibilityWhereExpression2({ user, userRole: user.role, publicRole }),
                {
                    OR: [
                        ...MakeWhereCondition([{ fieldName: "slug", fieldType: "string" }], query).OR,
                        {
                            currentRevision: MakeWhereCondition([
                                { fieldName: "content", fieldType: "string" },
                                { fieldName: "name", fieldType: "string" },
                            ], query),
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

    const makeEventInfo = (x: typeof events[0]): QuickSearchItemMatch => {
        const absoluteUri = process.env.CMDB_BASE_URL + `backstage/event/${x.id}/${slugify(x.name || "")}`;

        return {
            absoluteUri,
            name: `${x.name}${x.startsAt ? ` (${x.startsAt.toLocaleDateString()})` : ""}`,
            id: x.id,
            matchStrength: 1,
            itemType: "event",
        };
    };

    const makeSongInfo = (x: typeof songs[0]): QuickSearchItemMatch => {
        const absoluteUri = process.env.CMDB_BASE_URL + `backstage/song/${x.id}/${slugify(x.name || "")}`;
        return {
            id: x.id,
            absoluteUri,
            name: `${x.name}${x.introducedYear ? ` (${x.introducedYear})` : ""}`,
            matchStrength: 1,
            itemType: "song",
        };
    };

    const makeWikiPageInfo = (x: typeof wikiPages[0]): QuickSearchItemMatch => {
        const absoluteUri = process.env.CMDB_BASE_URL + `backstage/wiki/${x.slug}`; // 
        return {
            id: x.id,
            absoluteUri,
            name: x.currentRevision ? `${x.currentRevision.name} (${x.slug})` : x.slug,
            matchStrength: 1,
            itemType: "wikiPage",
        };
    };

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
        ...songs.map(s => makeSongInfo(s)),
        ...events.map(s => makeEventInfo(s)),
        ...wikiPages.map(s => makeWikiPageInfo(s)),
    ];

    ret = toSorted(ret, (a, b) => a.matchStrength - b.matchStrength);
    //ret = ret.slice(0, itemsToReturn);
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





