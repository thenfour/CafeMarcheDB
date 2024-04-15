import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args, ctx: AuthenticatedCtx) => {
        try {
            const contextDesc = `getPopularSongTags`;
            //CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);

            const items = await db.songTag.findMany({
                include: {
                    songs: true,
                },
                orderBy: {
                    songs: {
                        _count: "desc",
                    }
                },
                // i'd love to select only tags that actually have relations,
                // but that is not possible. https://github.com/prisma/prisma/issues/8935
                // where: {
                //     events: {
                //         _count: {
                //             gte: 2,
                //         }
                //     }
                // },
                take: 20,
            });

            return items;

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



