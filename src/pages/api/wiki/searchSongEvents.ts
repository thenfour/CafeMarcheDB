import { Ctx } from "@blitzjs/next";
import db from "db";
import { slugify } from "shared/rootroot";
import { api } from "src/blitz-server";
import { MakeMatchingSlugItem, MatchingSlugItem } from "src/core/db3/shared/apiTypes";

async function getMatchingSlugs(keyword: string): Promise<MatchingSlugItem[]> {
    keyword = keyword.toLowerCase();
    const songSlugs = await db.song.findMany({
        where: {
            OR: [
                { slug: { contains: keyword } },
                { aliases: { contains: keyword } },
                { name: { contains: keyword } },
            ],
        },
        select: {
            id: true,
            name: true,
            slug: true,
        },
        take: 10,
    });

    const eventSlugs = await db.event.findMany({
        where: {
            OR: [
                { slug: { contains: keyword } },
                { name: { contains: keyword } },
            ],
        },
        select: {
            id: true,
            name: true,
            slug: true,
        },
        take: 10,
    });

    const userSlugs = await db.user.findMany({
        where: {
            OR: [
                { name: { contains: keyword } },
            ],
        },
        select: {
            id: true,
            name: true,
        },
        take: 10,
    });

    const instrumentSlugs = await db.instrument.findMany({
        where: {
            OR: [
                { name: { contains: keyword } },
            ],
        },
        select: {
            id: true,
            name: true,
            slug: true,
        },
        take: 10,
    });

    const ret: MatchingSlugItem[] = [
        ...songSlugs.map(s => MakeMatchingSlugItem({ ...s, itemType: "song" })),
        ...eventSlugs.map(s => MakeMatchingSlugItem({ ...s, itemType: "event" })),
        ...userSlugs.map(s => MakeMatchingSlugItem({ ...s, slug: slugify(s.name), itemType: "user" })),
        ...instrumentSlugs.map(s => MakeMatchingSlugItem({ ...s, itemType: "instrument" })),
    ];

    return ret;
}

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {

        const { keyword } = req.query;

        if (typeof keyword !== "string" || keyword.trim() === "") {
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





