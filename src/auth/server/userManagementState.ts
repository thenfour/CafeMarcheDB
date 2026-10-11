// Server-side adapters and loaders for user-management authorization.

import type { Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { UserWithRolesArgs, UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import { PermissionSet } from "../shared/PermissionSet";
import { CMServerAuthorization, loadAuthorizationForUser } from "./serverAuthorization";
import {
    getContinuityWarningsForUserResult,
    UserManagementActor,
    type UserManagementPrincipal,
    UserManagementSubject,
    UserManagementTarget,
} from "./userManagementPolicy";

type RoleWithPermissionIdentities = {
    isDeleted: boolean;
    permissions: ReadonlyArray<{
        permission: {
            id: number;
            name: string;
            isDeleted: boolean;
        };
    }>;
};

type UserManagementPrincipalPayload = UserManagementPrincipal & {
    globalRole?: RoleWithPermissionIdentities | null;
    mergedIntoUserId?: number | null;
};

export const makePermissionSetFromRole = (role: RoleWithPermissionIdentities | null | undefined): PermissionSet => (
    new PermissionSet(role && !role.isDeleted ? role.permissions.filter(entry => !entry.permission.isDeleted).map(entry => entry.permission.name) : [])
);

export const makeUserManagementActor = (
    principal: UserManagementPrincipalPayload | null,
    auth: CMServerAuthorization,
): UserManagementActor => ({ principal, auth });

export const makeUserManagementTarget = (
    principal: UserManagementPrincipalPayload,
): UserManagementTarget => ({
    principal,
    rolePermissions: makePermissionSetFromRole(principal.globalRole),
});

export const findUserManagementTarget = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<UserManagementTarget | null> => {
    if (!userId) {
        return null;
    }
    const principal = await db.user.findFirst({
        select: { ...UserWithRolesArgs.select, mergedIntoUserId: true },
        where: { id: userId },
    });
    return principal ? makeUserManagementTarget(principal) : null;
};

export const findUserManagementTargetByPublicId = async (
    db: TransactionalPrismaClient,
    publicId: UserPublicId,
): Promise<UserManagementTarget | null> => {
    const principal = await db.user.findFirst({
        select: { ...UserWithRolesArgs.select, mergedIntoUserId: true },
        where: { publicId },
    });
    return principal ? makeUserManagementTarget(principal) : null;
};

export const findUserManagementActor = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<UserManagementActor> => {
    const principal: UserWithRolesPayload | null = userId ? await db.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: userId },
    }) : null;
    const auth = await loadAuthorizationForUser(principal, db);
    return makeUserManagementActor(principal, auth);
};

export const findActiveNonSysadminUsers = async (
    db: TransactionalPrismaClient,
): Promise<UserManagementSubject[]> => (
    await db.user.findMany({
        ...UserWithRolesArgs,
        where: {
            isDeleted: false,
            isSysAdmin: false,
            mergedIntoUserId: null,
        },
    })
).map(makeUserManagementTarget);

export const getUserManagementContinuityWarnings = async (
    db: TransactionalPrismaClient,
    target: UserManagementTarget,
    resultingRole: PermissionSet,
): Promise<Permission[]> => getContinuityWarningsForUserResult(
    target,
    resultingRole,
    await findActiveNonSysadminUsers(db),
);
