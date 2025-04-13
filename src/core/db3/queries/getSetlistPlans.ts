import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { DeserializeSetlistPlan } from "../shared/setlistPlanTypes";
import { GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression, GetUserVisibilityWhereExpression2 } from "../shared/db3Helpers";
import { getCurrentUserCore } from "../server/db3mutationCore";

const ZArgs = z.object({
    userId: z.number(),
});

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx) => {
        try {
            const user = await getCurrentUserCore(ctx);

            const results = await db.setlistPlan.findMany({
                where: {
                    createdByUserId: args.userId,
                    ...GetSoftDeleteWhereExpression(),
                    ...GetUserVisibilityWhereExpression(user),
                },
            });
            return results.map(DeserializeSetlistPlan);
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



