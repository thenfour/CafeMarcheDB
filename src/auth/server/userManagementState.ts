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
    permissions: ReadonlyArray<{
        permission: {
            id: number;
            name: string;
        };
    }>;
};

type UserManagementPrincipalPayload = UserManagementPrincipal & {
    globalRole?: RoleWithPermissionIdentities | null;
    mergedIntoUserId?: number | null;
};

export const makePermissionSetFromRole = (role: RoleWithPermissionIdentities | null | undefined): PermissionSet => (
    new PermissionSet(role?.permissions.map(entry => entry.permission.name) ?? [])
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


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userManagementState.ts:1-161
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 6baad7db1a98e7b38a8e0573f0cce7a2e43bf8352158b85523edf915319d02ba
// MIGRATION_REFERENCE_BEGIN
// // Server-side adapters and loaders for user-management authorization.
//
// import { Prisma } from "db";
// import type { Permission } from "shared/permissions";
// import type { RolePublicId, UserPublicId } from "shared/publicId";
// import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
// import { RoleArgs, RoleNaturalOrderBy } from "src/core/db3/shared/schema/prismArgs";
// import { xRole } from "src/core/db3/shared/schema/user";
// import { UserWithRolesArgs, UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
// import { PermissionSet } from "../shared/PermissionSet";
// import { CMServerAuthorization, loadAuthorizationForUser } from "./serverAuthorization";
// import {
//     canManageUser,
//     getContinuityWarningsForUserResult,
//     UserManagementActor,
//     type UserManagementPrincipal,
//     UserManagementSubject,
//     UserManagementTarget,
// } from "./userManagementPolicy";
//
// export type UserManagementRoleWithPermissions = Prisma.RoleGetPayload<typeof RoleArgs>;
//
// export type AssignableRole = Pick<
//     UserManagementRoleWithPermissions,
//     "name" | "description" | "sortOrder" | "color"
// > & {
//     publicId: RolePublicId;
//     continuityWarnings: Permission[];
// };
//
// type RoleWithPermissionIdentities = {
//     permissions: ReadonlyArray<{
//         permission: {
//             id: number;
//             name: string;
//         };
//     }>;
// };
//
// type UserManagementPrincipalPayload = UserManagementPrincipal & {
//     globalRole?: RoleWithPermissionIdentities | null;
//     mergedIntoUserId?: number | null;
// };
//
// export const makePermissionSetFromRole = (role: RoleWithPermissionIdentities | null | undefined): PermissionSet => (
//     new PermissionSet(role?.permissions.map(entry => entry.permission.name) ?? [])
// );
//
// export const makeUserManagementActor = (
//     principal: UserManagementPrincipalPayload | null,
//     auth: CMServerAuthorization,
// ): UserManagementActor => ({ principal, auth });
//
// export const makeUserManagementTarget = (
//     principal: UserManagementPrincipalPayload,
// ): UserManagementTarget => ({
//     principal,
//     rolePermissions: makePermissionSetFromRole(principal.globalRole),
// });
//
// export const findUserManagementTarget = async (
//     db: TransactionalPrismaClient,
//     userId: number | null | undefined,
// ): Promise<UserManagementTarget | null> => {
//     if (!userId) return null;
//     const principal = await db.user.findFirst({
//         select: { ...UserWithRolesArgs.select, mergedIntoUserId: true },
//         where: { id: userId },
//     });
//     return principal ? makeUserManagementTarget(principal) : null;
// };
//
// export const findUserManagementTargetByPublicId = async (
//     db: TransactionalPrismaClient,
//     publicId: UserPublicId,
// ): Promise<UserManagementTarget | null> => {
//     const principal = await db.user.findFirst({
//         select: { ...UserWithRolesArgs.select, mergedIntoUserId: true },
//         where: { publicId },
//     });
//     return principal ? makeUserManagementTarget(principal) : null;
// };
//
// export const findUserManagementActor = async (
//     db: TransactionalPrismaClient,
//     userId: number | null | undefined,
// ): Promise<UserManagementActor> => {
//     const principal: UserWithRolesPayload | null = userId ? await db.user.findFirst({
//         ...UserWithRolesArgs,
//         where: { id: userId },
//     }) : null;
//     const auth = await loadAuthorizationForUser(principal, db);
//     return makeUserManagementActor(principal, auth);
// };
//
// export const findUserManagementRole = async (
//     db: TransactionalPrismaClient,
//     roleId: number | null,
// ): Promise<UserManagementRoleWithPermissions | null> => {
//     if (roleId == null) return null;
//     return db.role.findFirst({
//         ...RoleArgs,
//         where: { id: roleId },
//     });
// };
//
// export const findActiveNonSysadminUsers = async (
//     db: TransactionalPrismaClient,
// ): Promise<UserManagementSubject[]> => (
//     await db.user.findMany({
//         ...UserWithRolesArgs,
//         where: {
//             isDeleted: false,
//             isSysAdmin: false,
//         },
//     })
// ).map(makeUserManagementTarget);
//
// export const getUserManagementContinuityWarnings = async (
//     db: TransactionalPrismaClient,
//     target: UserManagementTarget,
//     resultingRole: PermissionSet,
// ): Promise<Permission[]> => getContinuityWarningsForUserResult(
//     target,
//     resultingRole,
//     await findActiveNonSysadminUsers(db),
// );
//
// export const getAssignableRoles = async (
//     db: TransactionalPrismaClient,
//     actor: UserManagementActor,
//     target: UserManagementTarget,
//     activeNonSysadminUsers: readonly UserManagementSubject[],
// ): Promise<AssignableRole[]> => {
//     if (!canManageUser({ actor, target, action: "assignRole" })) return [];
//
//     const roles: UserManagementRoleWithPermissions[] = await db.role.findMany({
//         ...RoleArgs,
//         orderBy: RoleNaturalOrderBy,
//     });
//
//     return roles
//         .filter(role => canManageUser({
//             actor,
//             target,
//             action: "assignRole",
//             desiredRole: makePermissionSetFromRole(role),
//         }))
//         .map(role => ({
//             publicId: xRole.parseIdentity(role.publicId),
//             name: role.name,
//             description: role.description,
//             sortOrder: role.sortOrder,
//             color: role.color,
//             continuityWarnings: getContinuityWarningsForUserResult(
//                 target,
//                 makePermissionSetFromRole(role),
//                 activeNonSysadminUsers,
//             ),
//         }));
// };
// MIGRATION_REFERENCE_END
