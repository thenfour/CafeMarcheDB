import { cmauthorize } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { executePublicIdReorder, type PublicIdReorderRow } from "../server/db3PublicIdReorder";
import { resolvePublicId } from "../server/db3PublicIds";
import { DB3MutationAuthorizationError } from "../server/db3mutationCore";
import { xSetlistPlan, xSetlistPlanGroup } from "../shared/schema/setlistPlan";

const groupReorder = z.object({
    kind: z.literal("group"),
    movingPublicId: xSetlistPlanGroup.identitySchema,
    newPositionPublicId: xSetlistPlanGroup.identitySchema,
    scopePublicIds: z.array(xSetlistPlanGroup.identitySchema).min(1),
});

const planReorder = z.object({
    kind: z.literal("plan"),
    movingPublicId: xSetlistPlan.identitySchema,
    newPositionPublicId: xSetlistPlan.identitySchema,
    scopePublicIds: z.array(xSetlistPlan.identitySchema).min(1),
    groupId: xSetlistPlanGroup.identitySchema.nullable(),
});

export default resolver.pipe(
    cmauthorize(Permission.setlist_planner_access),
    resolver.zod(z.discriminatedUnion("kind", [groupReorder, planReorder])),
    async (args, ctx): Promise<void> => {
        const table = args.kind === "group" ? xSetlistPlanGroup : xSetlistPlan;
        await db.$transaction(async tx => {
            const changes = await executePublicIdReorder<PublicIdReorderRow>({
                table,
                auth: ctx.auth,
                scopePublicIds: args.scopePublicIds,
                movingPublicId: args.movingPublicId,
                newPositionPublicId: args.newPositionPublicId,
                loadRows: async () => {
                    const groupId = args.kind === "plan" && args.groupId
                        ? await resolvePublicId(xSetlistPlanGroup, args.groupId, ctx.auth, tx)
                        : null;
                    return args.kind === "group"
                        ? tx.setlistPlanGroup.findMany({
                            where: { publicId: { in: args.scopePublicIds } },
                            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                        })
                        : tx.setlistPlan.findMany({
                            where: { publicId: { in: args.scopePublicIds }, groupId, isDeleted: false },
                            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                        });
                },
                writeChange: async change => {
                    if (args.kind === "group") {
                        await tx.setlistPlanGroup.update({ where: { id: change.item.id }, data: { sortOrder: change.newSortOrder } });
                    } else {
                        await tx.setlistPlan.update({ where: { id: change.item.id }, data: { sortOrder: change.newSortOrder } });
                    }
                },
                error: () => new DB3MutationAuthorizationError(table.tableName, ["sortOrder"]),
            });
            // if (changes.length) {
            //     await RegisterChange({
            //         action: ChangeAction.update,
            //         changeContext: CreateChangeContext(`reorder:${table.tableName}`),
            //         table: table.tableName,
            //         pkid: 0,
            //         oldValues: changes.map(change => ({ publicId: change.item.publicId, sortOrder: change.oldSortOrder })),
            //         newValues: changes.map(change => ({ publicId: change.item.publicId, sortOrder: change.newSortOrder })),
            //         auth: ctx.auth,
            //         db: tx,
            //     });
            // }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
);
