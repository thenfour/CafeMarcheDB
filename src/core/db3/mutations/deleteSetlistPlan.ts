import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as mutationCore from "../server/db3mutationCore";
import { z } from "zod";

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    resolver.zod(z.object({ id: z.number() })),
    async (args, ctx: AuthenticatedCtx): Promise<void> => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) {
            throw new Error("No current user");
        }

        if (args.id < 0) {
            return; // quiet success
        }

        await db.setlistPlan.delete({
            where: {
                id: args.id,
            },
        });
    }
);

