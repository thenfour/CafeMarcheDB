// Server-side adapters and loaders for user-management authorization.

import { asPermission, type Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { HydrateUserWithRoles, UserWithRolesArgs, UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import { PermissionSet } from "../shared/PermissionSet";
import { CMServerAuthorization, loadAuthorizationForUser } from "./serverAuthorization";
import {
    getContinuityWarningsForUserResult,
    UserManagementActor,
    type UserManagementPrincipal,
    UserManagementSubject,
    UserManagementTarget,
} from "./userManagementPolicy";

type RoleWithPermissionIdentities<TPermissionName extends string = Permission> = {
    isDeleted: boolean;
    permissions: ReadonlyArray<{
        permission: {
            id: number;
            name: TPermissionName;
            isDeleted: boolean;
        };
    }>;
};

type UserManagementPrincipalPayload = UserManagementPrincipal & {
    globalRole?: RoleWithPermissionIdentities | null;
    mergedIntoUserId?: number | null;
};

// Authorization inspects persisted grants before DB3 can authorize a view read.
// Prisma exposes names as strings; validate them at this boundary, keeping PermissionSet typed.
export const makePermissionSetFromRole = (role: RoleWithPermissionIdentities<string> | null | undefined): PermissionSet => {
    if (!role || role.isDeleted) {
        return new PermissionSet([]);
    }
    const names = role.permissions
        .filter(entry => !entry.permission.isDeleted)
        .map(entry => asPermission(entry.permission.name));
    return new PermissionSet(names);
};

/** Clearing an assignment selects Public; it does not remove the global role slot. */
export async function loadGlobalPublicRoleGrants(db: TransactionalPrismaClient): Promise<PermissionSet> {
    const roles = await db.globalRole.findMany({
        where: { isPublicRole: true, isDeleted: false },
        include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== 1) {
        throw new Error("Authorization requires exactly one active Public global role.");
    }
    return makePermissionSetFromRole(roles[0]);
}

async function resolveUserManagementTarget(db: TransactionalPrismaClient, principal: UserManagementPrincipalPayload): Promise<UserManagementTarget> {
    const target = makeUserManagementTarget(principal);
    if (!principal.globalRole) {
        return {
            ...target,
            rolePermissions: await loadGlobalPublicRoleGrants(db),
        };
    }
    return target;
}

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
    return principal ? resolveUserManagementTarget(db, principal) : null;
};

export const findUserManagementTargetByPublicId = async (
    db: TransactionalPrismaClient,
    publicId: UserPublicId,
): Promise<UserManagementTarget | null> => {
    const principal = await db.user.findFirst({
        select: { ...UserWithRolesArgs.select, mergedIntoUserId: true },
        where: { publicId },
    });
    return principal ? resolveUserManagementTarget(db, principal) : null;
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
    const hydratedPrincipal = principal ? HydrateUserWithRoles(principal) : null;
    return makeUserManagementActor(hydratedPrincipal, auth);
};

export const findActiveUserManagementSubjects = async (
    db: TransactionalPrismaClient,
): Promise<UserManagementSubject[]> => {
    const principals = await db.user.findMany({
        ...UserWithRolesArgs,
        where: {
            isDeleted: false,
            mergedIntoUserId: null,
        },
    });
    const publicGrants = await loadGlobalPublicRoleGrants(db);
    return principals.map(principal => ({
        principal,
        rolePermissions: principal.globalRole ? makePermissionSetFromRole(principal.globalRole) : publicGrants,
    }));
};

export const getUserManagementContinuityWarnings = async (
    db: TransactionalPrismaClient,
    target: UserManagementTarget,
    resultingRole: PermissionSet,
): Promise<Permission[]> => getContinuityWarningsForUserResult(
    target,
    resultingRole,
    await findActiveUserManagementSubjects(db),
);
