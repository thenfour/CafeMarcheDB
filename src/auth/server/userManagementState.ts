// Server-side adapters and loaders for user-management authorization.

import { Prisma } from "db";
import type { Permission } from "shared/permissions";
import { parsePublicId, type RolePublicId } from "shared/publicId";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { RoleArgs, RoleNaturalOrderBy } from "src/core/db3/shared/schema/prismArgs";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { PermissionSet } from "../shared/PermissionSet";
import { loadEffectivePermissions } from "./effectivePermissions";
import {
    canManageUser,
    getContinuityWarningsForUserResult,
    UserManagementActor,
    type UserManagementPrincipal,
    UserManagementSubject,
    UserManagementTarget,
} from "./userManagementPolicy";

export type UserManagementRoleWithPermissions = Prisma.RoleGetPayload<typeof RoleArgs>;

export type AssignableRole = Pick<
    UserManagementRoleWithPermissions,
    "name" | "description" | "sortOrder" | "color"
> & {
    publicId: RolePublicId;
    continuityWarnings: Permission[];
};

type RoleWithPermissionIdentities = {
    permissions: ReadonlyArray<{
        permission: {
            id: number;
            name: string;
        };
    }>;
};

type UserManagementPrincipalPayload = UserManagementPrincipal & {
    role?: RoleWithPermissionIdentities | null;
    mergedIntoUserId?: number | null;
};

export const makePermissionSetFromRole = (role: RoleWithPermissionIdentities | null | undefined): PermissionSet => (
    new PermissionSet(role?.permissions.map(entry => entry.permission) ?? [])
);

export const makeUserManagementActor = (
    principal: UserManagementPrincipalPayload | null,
    effectivePermissions: PermissionSet,
): UserManagementActor => ({ principal, effectivePermissions });

export const makeUserManagementTarget = (
    principal: UserManagementPrincipalPayload,
): UserManagementTarget => ({
    principal,
    rolePermissions: makePermissionSetFromRole(principal.role),
});

export const findUserManagementTarget = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<UserManagementTarget | null> => {
    if (!userId) return null;
    const principal = await db.user.findFirst({
        select: { ...UserWithRolesArgs.select, mergedIntoUserId: true },
        where: { id: userId },
    });
    return principal ? makeUserManagementTarget(principal) : null;
};

export const findUserManagementActor = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<UserManagementActor> => {
    const principal = userId ? await db.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: userId },
    }) : null;
    const effectivePermissions = await loadEffectivePermissions(
        db,
        principal?.isDeleted ? null : principal,
    );
    return makeUserManagementActor(principal, effectivePermissions);
};

export const findUserManagementRole = async (
    db: TransactionalPrismaClient,
    roleId: number | null,
): Promise<UserManagementRoleWithPermissions | null> => {
    if (roleId == null) return null;
    return db.role.findFirst({
        ...RoleArgs,
        where: { id: roleId },
    });
};

export const findActiveNonSysadminUsers = async (
    db: TransactionalPrismaClient,
): Promise<UserManagementSubject[]> => (
    await db.user.findMany({
        ...UserWithRolesArgs,
        where: {
            isDeleted: false,
            isSysAdmin: false,
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

export const getAssignableRoles = async (
    db: TransactionalPrismaClient,
    actor: UserManagementActor,
    target: UserManagementTarget,
    activeNonSysadminUsers: readonly UserManagementSubject[],
): Promise<AssignableRole[]> => {
    if (!canManageUser({ actor, target, action: "assignRole" })) return [];

    const roles: UserManagementRoleWithPermissions[] = await db.role.findMany({
        ...RoleArgs,
        orderBy: RoleNaturalOrderBy,
    });

    return roles
        .filter(role => canManageUser({
            actor,
            target,
            action: "assignRole",
            desiredRole: makePermissionSetFromRole(role),
        }))
        .map(role => ({
            publicId: parsePublicId<"Role">(role.publicId),
            name: role.name,
            description: role.description,
            sortOrder: role.sortOrder,
            color: role.color,
            continuityWarnings: getContinuityWarningsForUserResult(
                target,
                makePermissionSetFromRole(role),
                activeNonSysadminUsers,
            ),
        }));
};
