import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as mutationCore from "../server/db3mutationCore";

export default resolver.pipe(
    resolver.authorize(Permission.setlist_planner_access),
    resolver.zod(z.object({ id: z.number() })),
    async (args, ctx: AuthenticatedCtx): Promise<void> => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) {
            throw new Error("No current user");
        }

        if (args.id < 0) {
            return; // quiet success
        }

        await db.setlistPlan.update({
            where: {
                id: args.id,
            },
            data: {
                isDeleted: true,
            },
        });
    }
);

