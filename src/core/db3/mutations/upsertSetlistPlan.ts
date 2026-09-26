import { loadAuthorization } from "@/src/auth/server/requestAuthorization";
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
//import { requireUnmergedUserReferences } from "src/auth/server/mergedUserReferences";
import * as mutationCore from "../server/db3mutationCore";
import { resolvePublicForeignIds } from "../server/db3PublicIds";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { db3Server } from "../server/db3Server";
import { xSetlistPlan } from "../shared/schema/setlistPlan";
import { DeserializeSetlistPlan, SetlistPlan, SetlistPlanWithVisibilityArgs, SetlistPlanWithVisibilityPayload, ZSetlistPlan } from "../shared/setlistPlanTypes";
import { cmauthorize } from "@/src/auth/server/cmResolver";

export default resolver.pipe(
    cmauthorize(Permission.setlist_planner_access),
    resolver.zod(ZSetlistPlan),
    async (args, ctx): Promise<SetlistPlan> => {

        const currentUserId = ctx.auth.userId;
        if (currentUserId == null) {
            throw new Error("No current user");
        }

        const resolvedForeignIds = await resolvePublicForeignIds(
            xSetlistPlan,
            { visiblePermissionId: args.visiblePermissionId, groupId: args.groupId ?? null },
            ctx.auth,
            db,
        );

        // const associatedUsers = [...args.payload.columns, ...(args.payload.columnLeds || []), ...(args.payload.rowLeds || [])]
        //     .map(item => item.associatedItem).filter(item => item?.itemType === "user").map(item => item!.id);
        //await requireUnmergedUserReferences(db, associatedUsers);

        const existing = args.publicId ? await db.setlistPlan.findFirst({
            where: await GetAuthorizedTableReadWhere({
                table: xSetlistPlan,
                currentUser: ctx.auth.user,
                where: { publicId: args.publicId },
            }),
        }) : null;

        if (args.publicId && !existing) throw new Error("Setlist plan was not found.");

        let newObj: SetlistPlanWithVisibilityPayload;

        if (existing) {
            // if group changes, set sortorder to 0.
            newObj = await db.setlistPlan.update({
                ...SetlistPlanWithVisibilityArgs,
                where: {
                    id: existing.id,
                },
                data: {
                    name: args.name,
                    groupId: resolvedForeignIds.groupId ?? null,
                    description: args.description,
                    payloadJson: JSON.stringify(args.payload),
                    isDeleted: false,
                    visiblePermissionId: resolvedForeignIds.visiblePermissionId,
                    sortOrder: existing.groupId === resolvedForeignIds.groupId ? existing.sortOrder : 0,
                },
            });
        } else {
            newObj = await db3Server.table(xSetlistPlan).createWithPublicId(publicId => db.setlistPlan.create({
                ...SetlistPlanWithVisibilityArgs,
                data: {
                    publicId,
                    name: args.name,
                    groupId: resolvedForeignIds.groupId ?? null,
                    createdByUserId: currentUserId,
                    description: args.description,
                    payloadJson: JSON.stringify(args.payload),
                    isDeleted: false,
                    visiblePermissionId: resolvedForeignIds.visiblePermissionId,
                },
            }));
        }

        return DeserializeSetlistPlan(newObj);
    }
);

