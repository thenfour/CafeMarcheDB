import { cmauthorize } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xSetlistPlan } from "../shared/schema/setlistPlan";

export default resolver.pipe(
    cmauthorize(Permission.setlist_planner_access),
    resolver.zod(xSetlistPlan.identitySchema),
    async (args, ctx): Promise<void> => {

        // TODO: use queryView for correct auth & sanitization

        const existing = await db.setlistPlan.findFirst({
            where: await GetAuthorizedTableReadWhere({
                table: xSetlistPlan,
                auth: ctx.auth,
                where: { publicId: args },
            }),
            select: { id: true },
        });
        if (!existing) throw new Error("Setlist plan was not found.");

        await db.setlistPlan.update({
            where: {
                id: existing.id,
            },
            data: {
                isDeleted: true,
            },
        });
    }
);

