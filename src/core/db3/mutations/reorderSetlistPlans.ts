// TODO: unify/centralize with updateGenericSortOrder, eventSongListReorderCommandHandler,
// galleryReorderCommandHandler

import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { moveItemInArray } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { createUsableSortOrderSlots } from "../server/db3SortOrder";
import { resolvePublicId } from "../server/db3PublicIds";
import { DB3MutationAuthorizationError } from "../server/db3mutationCore";
import { xSetlistPlan, xSetlistPlanGroup } from "../shared/schema/setlistPlan";
import { cmauthorize } from "@/src/auth/server/cmResolver";

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
        //const publicData = await loadAuthorization(ctx.session);
        const reject = () => { throw new DB3MutationAuthorizationError(table.tableName, ["sortOrder"]); };
        if (!table.authorizeTableForEdit(ctx.auth)
            || new Set<string>(args.scopePublicIds).size !== args.scopePublicIds.length
            || !args.scopePublicIds.some(id => id === args.movingPublicId)
            || !args.scopePublicIds.some(id => id === args.newPositionPublicId)) reject();

        await db.$transaction(async tx => {
            const groupId = args.kind === "plan" && args.groupId
                ? await resolvePublicId(xSetlistPlanGroup, args.groupId, ctx.auth, tx)
                : null;
            const rows = args.kind === "group"
                ? await tx.setlistPlanGroup.findMany({
                    where: { publicId: { in: args.scopePublicIds } },
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                })
                : await tx.setlistPlan.findMany({
                    where: { publicId: { in: args.scopePublicIds }, groupId, isDeleted: false },
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                });
            if (rows.length !== args.scopePublicIds.length || rows.some(row => !table.authorizeRowForView({ model: row, publicData: ctx.auth }))) reject();

            const from = rows.findIndex(row => row.publicId === args.movingPublicId);
            const to = rows.findIndex(row => row.publicId === args.newPositionPublicId);
            if (from < 0 || to < 0) reject();
            const sortable = rows.map(row => ({ row, sortOrder: row.sortOrder }));
            const reordered = moveItemInArray(sortable, from, to);
            const slots = createUsableSortOrderSlots(sortable, "sortOrder");
            const changes = reordered.flatMap(({ row, sortOrder }, index) => sortOrder === slots[index]
                ? []
                : [{ row, oldSortOrder: sortOrder, newSortOrder: slots[index]! }]);

            for (const change of changes) {
                const result = table.authorizeAndSanitize({
                    contextDesc: `reorder:${table.tableName}:preflight`,
                    model: { sortOrder: change.newSortOrder },
                    existingModel: change.row,
                    publicData: ctx.auth,
                    rowMode: "update",
                    fallbackOwnerId: null,
                });
                if (!result.rowIsAuthorized || result.unauthorizedColumnCount || result.unknownColumnCount) reject();
            }

            for (const change of changes) {
                if (args.kind === "group") {
                    await tx.setlistPlanGroup.update({ where: { id: change.row.id }, data: { sortOrder: change.newSortOrder } });
                } else {
                    await tx.setlistPlan.update({ where: { id: change.row.id }, data: { sortOrder: change.newSortOrder } });
                }
            }
            if (changes.length) {
                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext: CreateChangeContext(`reorder:${table.tableName}`),
                    table: table.tableName,
                    pkid: 0,
                    oldValues: changes.map(change => ({ publicId: change.row.publicId, sortOrder: change.oldSortOrder })),
                    newValues: changes.map(change => ({ publicId: change.row.publicId, sortOrder: change.newSortOrder })),
                    ctx,
                    db: tx,
                });
            }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
);
