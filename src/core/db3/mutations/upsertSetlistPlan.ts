import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
//import { requireUnmergedUserReferences } from "src/auth/server/mergedUserReferences";
import * as mutationCore from "../server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xSetlistPlan } from "../shared/schema/setlistPlan";
import { DeserializeSetlistPlan, SetlistPlan, ZSetlistPlan } from "../shared/setlistPlanTypes";

export default resolver.pipe(
    resolver.authorize(Permission.setlist_planner_access),
    resolver.zod(ZSetlistPlan),
    async (args, ctx: AuthenticatedCtx): Promise<SetlistPlan> => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        if (!currentUser) {
            throw new Error("No current user");
        }

        // const associatedUsers = [...args.payload.columns, ...(args.payload.columnLeds || []), ...(args.payload.rowLeds || [])]
        //     .map(item => item.associatedItem).filter(item => item?.itemType === "user").map(item => item!.id);
        //await requireUnmergedUserReferences(db, associatedUsers);

        const existing = await db.setlistPlan.findFirst({
            where: await GetAuthorizedTableReadWhere({
                table: xSetlistPlan,
                currentUser,
                where: { id: args.id },
            }),
        });

        if (args.id > 0 && !existing) throw new Error("Setlist plan was not found.");

        let newObj: Prisma.SetlistPlanGetPayload<{}>;

        if (existing) {
            // if group changes, set sortorder to 0.
            const sortOrderUpdate = {};
            if (existing.groupId !== args.groupId) {
                sortOrderUpdate['sortOrder'] = 0;
            }
            newObj = await db.setlistPlan.update({
                where: {
                    id: args.id,
                },
                data: {
                    name: args.name,
                    groupId: args.groupId || null,
                    description: args.description,
                    payloadJson: JSON.stringify(args.payload),
                    isDeleted: false,
                    visiblePermissionId: args.visiblePermissionId,
                    ...sortOrderUpdate,
                },
            });
        } else {
            newObj = await db.setlistPlan.create({
                data: {
                    name: args.name,
                    groupId: args.groupId || null,
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

