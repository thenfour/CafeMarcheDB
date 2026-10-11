import type { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import type { GlobalRolePublicId, UserPublicId } from "shared/publicId";
import { ChangeAction, CreateChangeContext, RegisterChange } from "./activityLog";
import type { CMServerAuthorization } from "./serverAuthorization";
import { requireCanManageUser, requireContinuityAcknowledgement } from "./userManagementPolicy";
import { findUserManagementTargetByPublicId, getUserManagementContinuityWarnings, makePermissionSetFromRole } from "./userManagementState";

export interface AccountRoleEdit {
    readonly userId: UserPublicId;
    readonly roleId: GlobalRolePublicId | null;
    readonly acknowledgeContinuityRisk: boolean;
}

/** Shared account roles never change either membership or its role. */
export async function writeAccountRole(database: Prisma.TransactionClient, authorization: CMServerAuthorization, edit: AccountRoleEdit) {
    const auth = (await authorization.refresh(database)).requireUser();
    auth.requirePermission(Permission.manage_global_users);
    const target = await findUserManagementTargetByPublicId(database, edit.userId);
    const desiredRole = edit.roleId === null ? null : await database.globalRole.findFirst({
        where: {
            publicId: edit.roleId,
            isDeleted: false
        },
        include: { permissions: { include: { permission: true } } },
    });
    if (!target || (edit.roleId !== null && !desiredRole)) {
        throw new NotFoundError();
    }
    const desiredGrants = makePermissionSetFromRole(desiredRole);

    requireCanManageUser({
        actor: { principal: auth.user, auth },
        target,
        action: "assignRole",
        desiredRole: desiredGrants
    });
    const person = await database.user.findUniqueOrThrow({
        where: { id: target.principal.id },
        select: { globalRoleId: true, isSysAdmin: true }
    });
    const desiredId = desiredRole?.id ?? null;
    if (person.globalRoleId === desiredId) {
        return {
            userId: edit.userId,
            roleId: edit.roleId,
            continuityWarnings: []
        };
    }
    // Account-flag administrators keep their designated role even when the explicit role is cleared.
    const effectiveDesired = person.isSysAdmin ? target.rolePermissions : desiredGrants;
    const continuityWarnings = await getUserManagementContinuityWarnings(database, target, effectiveDesired);
    requireContinuityAcknowledgement(continuityWarnings, edit.acknowledgeContinuityRisk);
    await database.user.update({
        where: { id: target.principal.id },
        data: { globalRoleId: desiredId }
    });
    await RegisterChange({
        action: ChangeAction.update,
        changeContext: CreateChangeContext("assignUserRole"),
        table: "User",
        pkid: target.principal.id,
        oldValues: { globalRoleId: person.globalRoleId },
        newValues: { globalRoleId: desiredId },
        auth,
        db: database
    });
    return { userId: edit.userId, roleId: edit.roleId, continuityWarnings };
}
