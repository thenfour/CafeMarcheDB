import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import { AuthorizationError, NotFoundError } from "blitz";
import type { BandPublicId, PermissionPublicId, SetlistPlanPublicId } from "shared/publicId";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { xSetlistPlan, xSetlistPlanGroup, SetlistPlanNaturalOrderBy } from "../shared/schema/setlistPlan";
import {
    ZDeleteSetlistPlanArgs, ZListSetlistPlansArgs, ZReorderSetlistPlansArgs, ZSaveSetlistPlanArgs,
    type DeleteSetlistPlanArgs, type ListSetlistPlansArgs, type ReorderSetlistPlansArgs, type SaveSetlistPlanArgs,
} from "../shared/setlistPlanApi";
import { DeserializeSetlistPlan, SetlistPlanWithVisibilityArgs } from "../shared/setlistPlanTypes";
import { executeDB3Read, type DB3ReadDatabase, type DB3ReadRootDatabase } from "./db3ReadExecution";
import { GetAuthorizedTableReadWhere } from "./db3ReadPolicy";
import { resolvePublicId } from "./db3PublicIds";
import { executePublicIdReorder, type PublicIdReorderRow } from "./db3PublicIdReorder";
import { db3Server } from "./db3Server";
import { authorizePlanPayloadReferences } from "./setlistPlanReferences";
import { selectableBandVisibilityPermissionWhere } from "../shared/entities/user/visibilityPermissionPolicy";

function requirePlannerScope(authorization: CMServerAuthorization, bandPublicId: BandPublicId) {
    const auth = authorization.requireUser();
    if (auth.requireBand().publicId !== bandPublicId) {
        throw new AuthorizationError("Setlist planning requires the selected band.");
    }
    auth.requirePermission(BandPermission.setlist_planner_access);
    return auth;
}

async function findVisiblePlan(database: Prisma.TransactionClient, auth: CMServerAuthorization, publicId: SetlistPlanPublicId) {
    const plan = await database.setlistPlan.findFirst({
        where: await GetAuthorizedTableReadWhere({ table: xSetlistPlan, auth, where: { publicId } }),
    });
    if (!plan) {
        throw new NotFoundError();
    }
    return plan;
}

async function resolvePlanVisibility(database: Prisma.TransactionClient, auth: CMServerAuthorization, publicId: PermissionPublicId | null) {
    if (publicId === null) {
        return null;
    }
    const visibility = await database.permission.findFirst({
        where: {
            publicId,
            ...selectableBandVisibilityPermissionWhere(auth),
        }, select: { id: true }
    });
    if (!visibility) {
        throw new NotFoundError();
    }
    return visibility.id;
}


/** Composition boundary: the caller owns a Serializable transaction. */
export async function saveSetlistPlanInTransaction(database: Prisma.TransactionClient, authorization: CMServerAuthorization, input: SaveSetlistPlanArgs) {
    const { bandPublicId, plan } = ZSaveSetlistPlanArgs.parse(input);
    const auth = requirePlannerScope(await authorization.refresh(database), bandPublicId);
    const existing = plan.publicId ? await findVisiblePlan(database, auth, plan.publicId) : null;
    const groupId = plan.groupId ? await resolvePublicId(xSetlistPlanGroup, plan.groupId, auth, database) : null;
    const visiblePermissionId = await resolvePlanVisibility(database, auth, plan.visiblePermissionId);
    await authorizePlanPayloadReferences(database, auth, plan.payload);
    const fields = {
        name: plan.name,
        description: plan.description,
        groupId,
        visiblePermissionId,
        payloadJson: JSON.stringify(plan.payload)
    };
    const saved = existing
        ? await database.setlistPlan.update({
            ...SetlistPlanWithVisibilityArgs,
            where: { id: existing.id },
            data: {
                ...fields,
                sortOrder: existing.groupId === groupId ? existing.sortOrder : 0
            }
        })
        : await db3Server.table(xSetlistPlan).createWithPublicId(publicId => database.setlistPlan.create({
            ...SetlistPlanWithVisibilityArgs,
            data: {
                ...fields,
                publicId,
                bandId: auth.requireBand().id,
                createdByUserId: auth.userId
            },
        }));
    await RegisterChange({
        action: existing ? ChangeAction.update : ChangeAction.insert,
        changeContext: CreateChangeContext("save:SetlistPlan"),
        table: "SetlistPlan",
        pkid: saved.id,
        oldValues: existing ?? undefined,
        newValues: saved,
        auth,
        db: database,
    });
    return DeserializeSetlistPlan(saved);
}

export function saveSetlistPlan(database: DB3ReadRootDatabase, authorization: CMServerAuthorization, args: SaveSetlistPlanArgs) {
    return database.$transaction(tx => saveSetlistPlanInTransaction(tx, authorization, args), { isolationLevel: "Serializable" });
}

export function listSetlistPlans(database: DB3ReadDatabase, authorization: CMServerAuthorization, input: ListSetlistPlansArgs) {
    const args = ZListSetlistPlansArgs.parse(input);
    return executeDB3Read(database,
        authorization,
        async context => {
            const auth = requirePlannerScope(context.authorization, args.bandPublicId);
            const plans = await context.database.setlistPlan.findMany({
                ...SetlistPlanWithVisibilityArgs,
                orderBy: SetlistPlanNaturalOrderBy,
                where: await GetAuthorizedTableReadWhere({
                    table: xSetlistPlan,
                    auth,
                    where:
                        args.userId === null ? {} : { createdByUser: { publicId: args.userId } },
                }),
            });
            return plans.map(DeserializeSetlistPlan);
        });
}

/** Composition boundary: the caller owns a Serializable transaction. */
export async function deleteSetlistPlanInTransaction(database: Prisma.TransactionClient, authorization: CMServerAuthorization, input: DeleteSetlistPlanArgs) {
    const args = ZDeleteSetlistPlanArgs.parse(input);
    const auth = requirePlannerScope(await authorization.refresh(database), args.bandPublicId);
    const existing = await findVisiblePlan(database, auth, args.publicId);
    const deleted = await database.setlistPlan.update({
        where: { id: existing.id },
        data: { isDeleted: true }
    });
    await RegisterChange({
        action: ChangeAction.delete,
        changeContext: CreateChangeContext("delete:SetlistPlan"),
        table: "SetlistPlan",
        pkid: existing.id,
        oldValues: existing,
        newValues: deleted,
        auth,
        db: database
    });
}

export function deleteSetlistPlan(database: DB3ReadRootDatabase, authorization: CMServerAuthorization, args: DeleteSetlistPlanArgs) {
    return database.$transaction(tx => deleteSetlistPlanInTransaction(tx, authorization, args), { isolationLevel: "Serializable" });
}

/** Composition boundary: the caller owns a Serializable transaction. */
export async function reorderSetlistPlansInTransaction(database: Prisma.TransactionClient, authorization: CMServerAuthorization, input: ReorderSetlistPlansArgs) {
    const args = ZReorderSetlistPlansArgs.parse(input);
    const auth = requirePlannerScope(await authorization.refresh(database), args.bandPublicId);
    const table = args.kind === "group" ? xSetlistPlanGroup : xSetlistPlan;
    const groupId = args.kind === "plan" && args.groupId ? await resolvePublicId(xSetlistPlanGroup, args.groupId, auth, database) : null;
    const policy = await GetAuthorizedTableReadWhere({ table, auth, where: { publicId: { in: args.scopePublicIds } } });
    const changes = await executePublicIdReorder<PublicIdReorderRow>({
        table, auth, scopePublicIds: args.scopePublicIds, movingPublicId: args.movingPublicId, newPositionPublicId: args.newPositionPublicId,
        loadRows: () => args.kind === "group"
            ? database.setlistPlanGroup.findMany({ where: policy, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] })
            : database.setlistPlan.findMany({ where: { AND: [policy, { groupId, isDeleted: false }] }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
        writeChange: async change => {
            if (args.kind === "group") {
                await database.setlistPlanGroup.update({ where: { id: change.item.id }, data: { sortOrder: change.newSortOrder } });
            } else {
                await database.setlistPlan.update({ where: { id: change.item.id }, data: { sortOrder: change.newSortOrder } });
            }
        },
        error: () => new AuthorizationError("Setlist reorder scope is unavailable."),
    });
    if (changes.length) {
        await RegisterChange({
            action: ChangeAction.update, changeContext: CreateChangeContext(`reorder:${table.tableName}`),
            table: table.tableName, pkid: 0,
            oldValues: changes.map(change => ({ publicId: change.item.publicId, sortOrder: change.oldSortOrder })),
            newValues: changes.map(change => ({ publicId: change.item.publicId, sortOrder: change.newSortOrder })), auth, db: database
        });
    }
}

export function reorderSetlistPlans(database: DB3ReadRootDatabase, authorization: CMServerAuthorization, args: ReorderSetlistPlansArgs) {
    return database.$transaction(tx => reorderSetlistPlansInTransaction(tx, authorization, args), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
