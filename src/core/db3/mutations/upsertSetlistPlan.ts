import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as mutationCore from "../server/db3mutationCore";
import { DeserializeSetlistPlan, SetlistPlan, ZSetlistPlan } from "../shared/setlistPlanTypes";

export default resolver.pipe(
    resolver.authorize(Permission.setlist_planner_access),
    resolver.zod(ZSetlistPlan),
    async (args, ctx: AuthenticatedCtx): Promise<SetlistPlan> => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) {
            throw new Error("No current user");
        }

        const existing = await db.setlistPlan.findFirst({
            where: {
                id: args.id,
            },
        });

        let newObj: Prisma.SetlistPlanGetPayload<{}>;

        if (existing) {
            newObj = await db.setlistPlan.update({
                where: {
                    id: args.id,
                },
                data: {
                    name: args.name,
                    groupName: args.groupName || "",
                    description: args.description,
                    payloadJson: JSON.stringify(args.payload),
                    isDeleted: false,
                    visiblePermissionId: args.visiblePermissionId,
                },
            });
        } else {
            newObj = await db.setlistPlan.create({
                data: {
                    name: args.name,
                    groupName: args.groupName || "",
                    createdByUserId: currentUser.id,
                    description: args.description,
                    payloadJson: JSON.stringify(args.payload),
                    isDeleted: false,
                    visiblePermissionId: args.visiblePermissionId,
                },
            });
        }

        return DeserializeSetlistPlan(newObj);
    }
);

