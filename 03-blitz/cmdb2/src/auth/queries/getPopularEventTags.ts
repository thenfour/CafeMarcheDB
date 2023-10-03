import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";

export default resolver.pipe(
    resolver.authorize("getPopularEventTags", Permission.login),
    async (args, ctx: AuthenticatedMiddlewareCtx) => {
        try {
            const contextDesc = `getPopularEventTags`;
            //CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);

            const items = await db.eventTag.findMany({
                include: {
                    events: true,
                },
                orderBy: {
                    events: {
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
                take: 10,
            });

            return items;

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



