// TODO: unify with the normal search api.

import { Ctx } from "@blitzjs/next";
import db, { Prisma } from "db";
import { MakeWhereInputConditions, ParseQuickFilter } from "shared/utils";
import { api } from "src/blitz-server";
import { MakeMatchingSlugItem, MatchingSlugItem } from "src/core/db3/shared/apiTypes";



async function getMatchingSlugs(keyword__: string): Promise<MatchingSlugItem[]> {

    //const keywords = SplitQuickFilter(keyword.toLowerCase());
    const query = ParseQuickFilter(keyword__);
    const itemsPerType = 5;

    const songSlugs = await db.song.findMany({
        where: {
            AND: [
                {
                    isDeleted: false,
                },
                {
                    NOT: { visiblePermissionId: null }
                    // TODO: check actual perms.
                },
                {
                    OR: [
                        { AND: MakeWhereInputConditions("aliases", query.keywords) },
                        { AND: MakeWhereInputConditions("name", query.keywords) },
                        //{ aliases: { contains: keyword } },
                        //{ name: { contains: keyword } },
                    ]
                },
            ],
        },
        select: {
            id: true,
            name: true,
            introducedYear: true,
            //slug: true,
        },
        take: itemsPerType,
    });

    let eventAndCriteria: Prisma.EventWhereInput[] = MakeWhereInputConditions("name", query.keywordsWithoutDate);

    if (query.dateRange) {
        eventAndCriteria.push({
            startsAt: {
                gte: query.dateRange.start,
                lt: query.dateRange.end,
            },
        });
    }

    const eventSlugs = await db.event.findMany({
        where: {
            AND: [
                {
                    isDeleted: false,
                },
                {
                    NOT: { visiblePermissionId: null }
                    // TODO: check actual perms.
                },
                ...eventAndCriteria,
            ],
        },
        select: {
            id: true,
            name: true,
            startsAt: true,
        },
        orderBy: {
            startsAt: "asc",
        },
        take: itemsPerType,
    });

    const userSlugs = await db.user.findMany({
        where: {
            AND: [
                {
                    isDeleted: false,
                },
                ...MakeWhereInputConditions("name", query.keywords),
            ],
        },
        select: {
            id: true,
            name: true,
        },
        take: itemsPerType,
    });

    const instrumentSlugs = await db.instrument.findMany({
        where: {
            AND: MakeWhereInputConditions("name", query.keywords),
        },
        select: {
            id: true,
            name: true,
            //slug: true,
        },
        take: 10,
    });

    const makeEventName = (x: typeof eventSlugs[0]) => {
        if (x.startsAt) {
            return `${x.name} (${x.startsAt.toDateString()})`;
        }
        return x.name;
    };

    const makeSongName = (x: typeof songSlugs[0]) => {
        if (x.introducedYear) {
            return `${x.name} (${x.introducedYear})`;
        }
        return x.name;
    };

    const ret: MatchingSlugItem[] = [
        ...songSlugs.map(s => MakeMatchingSlugItem({ ...s, name: makeSongName(s), itemType: "song" })),
        ...eventSlugs.map(s => MakeMatchingSlugItem({ ...s, name: makeEventName(s), itemType: "event" })),
        ...userSlugs.map(s => MakeMatchingSlugItem({ ...s, itemType: "user" })),
        ...instrumentSlugs.map(s => MakeMatchingSlugItem({ ...s, itemType: "instrument" })),
    ];

    return ret;
}

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {

        const { keyword } = req.query;

        if (typeof keyword !== "string") {
            res.status(400).json({ error: "A valid keyword must be provided" });
            return;
        }

        try {
            const slugs = await getMatchingSlugs(keyword);
            res.status(200).json(slugs);
        } catch (error) {
            console.error("Failed to fetch slugs", error);
            res.status(500).json({ error: "Failed to fetch data" });
        }
    }); // return new promise
});





