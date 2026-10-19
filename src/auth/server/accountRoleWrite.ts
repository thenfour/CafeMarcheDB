import type { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import { parsePublicId, type GlobalRolePublicId, type UserPublicId } from "shared/publicId";
import { ChangeAction, CreateChangeContext, RegisterChange } from "./activityLog";
import type { CMServerAuthorization } from "./serverAuthorization";
import { requireCanManageUser, requireContinuityAcknowledgement } from "./userManagementPolicy";
import { findUserManagementTargetByPublicId, getUserManagementContinuityWarnings, loadGlobalPublicRoleGrants, makePermissionSetFromRole } from "./userManagementState";

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
    const desiredGrants = desiredRole ? makePermissionSetFromRole(desiredRole) : await loadGlobalPublicRoleGrants(database);

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
    const desiredIsSysadmin = desiredGrants.includesName(Permission.sysadmin);
    if (person.globalRoleId === desiredId && person.isSysAdmin === desiredIsSysadmin) {
        return {
            userId: edit.userId,
            roleId: edit.roleId,
            continuityWarnings: []
        };
    }
    const continuityWarnings = await getUserManagementContinuityWarnings(database, target, desiredGrants);
    requireContinuityAcknowledgement(continuityWarnings, edit.acknowledgeContinuityRisk);
    await database.user.update({
        where: { id: target.principal.id },
        data: { globalRoleId: desiredId, isSysAdmin: desiredIsSysadmin }
    });
    await RegisterChange({
        action: ChangeAction.update,
        changeContext: CreateChangeContext("assignUserRole"),
        table: "User",
        pkid: target.principal.id,
        oldValues: { globalRoleId: person.globalRoleId, isSysAdmin: person.isSysAdmin },
        newValues: { globalRoleId: desiredId, isSysAdmin: desiredIsSysadmin },
        auth,
        db: database
    });
    return { userId: edit.userId, roleId: edit.roleId, continuityWarnings };
}

/** The existing administrator control assigns a role; its display flag confers no authority. */
export async function writeAccountAdministratorRole(database: Prisma.TransactionClient, authorization: CMServerAuthorization,
    edit: Readonly<{ userId: UserPublicId; isSysAdmin: boolean }>,
) {
    const auth = (await authorization.refresh(database)).requireUser();
    const target = await findUserManagementTargetByPublicId(database, edit.userId);
    if (!target) {
        throw new NotFoundError();
    }
    requireCanManageUser({ actor: { principal: auth.user, auth }, target, action: "setSysAdmin" });
    const roles = await database.globalRole.findMany({
        where: {
            isDeleted: false,
            ...(edit.isSysAdmin ? { isSysAdminRole: true } : { isRoleForNewUsers: true })
        },
        include: {
            permissions: {
                include: {
                    permission: true
                }
            }
        },
    });
    const role = roles[0];
    if (roles.length !== 1 || !role) {
        throw new Error("Account administration requires exactly one active designated target role.");
    }
    if (makePermissionSetFromRole(role).includesName(Permission.sysadmin) !== edit.isSysAdmin) {
        throw new Error("The designated role must match the requested administrator authority.");
    }
    await writeAccountRole(database, auth, {
        userId: edit.userId,
        roleId: parsePublicId<"GlobalRole">(role.publicId),
        acknowledgeContinuityRisk: false,
    });
    return edit;
}
