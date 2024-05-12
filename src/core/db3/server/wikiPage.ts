import db from "db";
import { AuxUserArgs, } from "types";

export const GetWikiPageCore = async ({ slug }: { slug: string }) => {
    const ret = await db.wikiPage.findUnique({
        where: { slug },
        select: {
            slug: true,
            revisions: { // take only the 1st most recent revision
                take: 1,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    wikiPage: {
                        include: {
                            visiblePermission: true,
                        }
                    },
                    createdByUser: AuxUserArgs,
                }
            },
        },
    });
    return ret;

};