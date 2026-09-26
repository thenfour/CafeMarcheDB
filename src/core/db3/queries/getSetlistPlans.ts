import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserPublicIdSchema } from "src/auth/schemas";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xSetlistPlan } from "../shared/schema/setlistPlan";
import { DeserializeSetlistPlan, SetlistPlanWithVisibilityArgs } from "../shared/setlistPlanTypes";

const ZArgs = z.object({
    userId: UserPublicIdSchema,
});

export default resolver.pipe(
    resolver.authorize(Permission.setlist_planner_access),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx) => {
        try {
            const user = await getCurrentUserCore(ctx);
            if (!user) throw new Error("Current user was not found.");
            const target = await db.user.findUnique({ where: { publicId: args.userId }, select: { id: true } });
            if (!target) return [];

            const results = await db.setlistPlan.findMany({
                ...SetlistPlanWithVisibilityArgs,
                where: await GetAuthorizedTableReadWhere({
                    table: xSetlistPlan,
                    currentUser: user,
                    where: { createdByUserId: target.id },
                }),
            });
            return results.map(DeserializeSetlistPlan);
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



