import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";

const ZInp = z.object({
    userTagIds: z.array(z.number()),
});

export default resolver.pipe(
    resolver.authorize(Permission.public),
    resolver.zod(ZInp),
    async (args, ctx: AuthenticatedCtx) => {
        try {
            return await db.userTag.findMany({
                where: {
                    id: { in: args.userTagIds },
                },
                select: {
                    id: true,
                    text: true,
                    userAssignments: {
                        select: {
                            userId: true,
                        }
                    }
                }
            });
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



