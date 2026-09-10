// server-side API for user auth auth

import { Prisma } from "db";
import type { Permission } from "shared/permissions";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { RoleArgs, RoleNaturalOrderBy } from "src/core/db3/shared/schema/prismArgs";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import {
    canManageUser,
    getContinuityWarningsForUserResult,
    type UserManagementPrincipal,
    type UserManagementRole,
} from "./userManagementPolicy";

export type UserManagementRoleWithPermissions = Prisma.RoleGetPayload<typeof RoleArgs>;

export type AssignableRole = Pick<
    UserManagementRoleWithPermissions,
    "id" | "name" | "description" | "sortOrder" | "color"
> & {
    continuityWarnings: Permission[];
};

export const findUserManagementPrincipal = (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
) => {
    if (!userId) return Promise.resolve(null);
    return db.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: userId },
    });
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

export const findActiveNonSysadminUsers = (
    db: TransactionalPrismaClient,
): Promise<UserManagementPrincipal[]> => db.user.findMany({
    ...UserWithRolesArgs,
    where: {
        isDeleted: false,
        isSysAdmin: false,
    },
});

export const getUserManagementContinuityWarnings = async (
    db: TransactionalPrismaClient,
    target: UserManagementPrincipal,
    resultingRole: UserManagementRole,
): Promise<Permission[]> => getContinuityWarningsForUserResult(
    target,
    resultingRole,
    await findActiveNonSysadminUsers(db),
);

export const getAssignableRoles = async (
    db: TransactionalPrismaClient,
    actor: UserManagementPrincipal | null,
    target: UserManagementPrincipal,
    activeNonSysadminUsers: readonly UserManagementPrincipal[],
): Promise<AssignableRole[]> => {
    if (!canManageUser({ actor, target, action: "assignRole" })) return [];

    const roles: UserManagementRoleWithPermissions[] = await db.role.findMany({
        ...RoleArgs,
        orderBy: RoleNaturalOrderBy,
    });

    return roles
        .filter(role => canManageUser({ actor, target, action: "assignRole", desiredRole: role }))
        .map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            sortOrder: role.sortOrder,
            color: role.color,
            continuityWarnings: getContinuityWarningsForUserResult(
                target,
                role,
                activeNonSysadminUsers,
            ),
        }));
};
