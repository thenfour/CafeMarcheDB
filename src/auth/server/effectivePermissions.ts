import { distinctValuesOfArray } from "@/shared/arrayUtils";
import { isPermission, Permission } from "@/shared/permissions";
import type { UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { CreatePublicData, type CreatePublicDataArgs, type PublicDataType } from "types";

type PermissionBearingPrincipal = Pick<UserWithRolesPayload, "id" | "isSysAdmin" | "role">;

export type EffectivePermissions = {
    ids: number[];
    names: Permission[];
};

// accepts a user with roles & permissions, and applies public & sysadmin inherited perms.
export const loadEffectivePermissions = async (
    db: TransactionalPrismaClient,
    user: PermissionBearingPrincipal | null | undefined,
): Promise<EffectivePermissions> => {

    // load defs for inherited roles for the user.
    // all users inherit public permissions,
    // User.isSysadmin maps to the sysadmin role.
    const specialRoles = await db.role.findMany({
        where: {
            OR: [
                { isPublicRole: true },
                ...(user?.isSysAdmin ? [{ isSysAdminRole: true }] : []),
            ],
        },
        include: {
            permissions: {
                include: { permission: true },
            },
        },
    });

    // take single roles
    const publicRoles = specialRoles.filter(role => role.isPublicRole);
    const publicRole = publicRoles.length === 1 ? publicRoles[0] : null;

    const sysadminRoles = specialRoles.filter(role => role.isSysAdminRole);
    const sysadminRole = sysadminRoles.length === 1 ? sysadminRoles[0] : null;

    // flatten all (may contain dupes)
    const entries = [
        ...(publicRole?.permissions || []),
        ...(user?.role?.permissions || []),
        ...(sysadminRole?.permissions || []),
    ];

    const deduped = distinctValuesOfArray(entries, (a, b) => a.permissionId === b.permissionId);
    const recognized = deduped.filter(
        (entry): entry is typeof entry & { permission: { name: Permission } } =>
            isPermission(entry.permission.name),
    );
    const unknownNames = deduped
        .map(entry => entry.permission.name)
        .filter(name => !isPermission(name));
    if (unknownNames.length > 0) {
        console.warn(`Ignoring unknown persisted permissions: ${unknownNames.join(", ")}`);
    }

    return {
        ids: recognized.map(entry => entry.permissionId),
        names: recognized.map(entry => entry.permission.name),
    }
};

export const loadEffectivePermissionNames = async (
    db: TransactionalPrismaClient,
    user: PermissionBearingPrincipal | null | undefined,
): Promise<string[]> => (await loadEffectivePermissions(db, user)).names;

export const createPublicDataFromDatabase = async (
    db: TransactionalPrismaClient,
    args: Omit<CreatePublicDataArgs, "permissions">,
): Promise<PublicDataType> => CreatePublicData({
    ...args,
    permissions: await loadEffectivePermissionNames(db, args.user),
});
