import { Ctx } from "@blitzjs/next";
import db from "db";
import { api } from "src/blitz-server";


async function getMatchingSlugs(keyword: string): Promise<string[]> {
    const slugs = await db.wikiPage.findMany({
        where: {
            slug: {
                contains: keyword.toLowerCase(),
            },
        },
        select: {
            slug: true,
        },
        take: 10,
    });

    return slugs.map(slug => slug.slug);
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





