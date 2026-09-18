import { distinctValuesOfArray } from "@/shared/arrayUtils";
import { isPermission, Permission } from "@/shared/permissions";
import { PermissionSet } from "../shared/PermissionSet";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { CreatePublicData, type CreatePublicDataArgs, type PublicDataType } from "types";
import type { Prisma, PrismaClient } from "@prisma/client";

type UserWithPermissions = Prisma.UserGetPayload<{
    select: {
        id: true,
        isSysAdmin: true,
        role: {
            include: {
                permissions: {
                    include: {
                        permission: {
                            select: {
                                id: true,
                                name: true,
                            },
                        }
                    },
                },
            },
        },
    },
}>;

// accepts a user with roles & permissions, and applies public & sysadmin inherited perms.
export const loadEffectivePermissions = async (
    db_: TransactionalPrismaClient,
    user: UserWithPermissions | null | undefined,
): Promise<PermissionSet> => {

    const db = db_ as PrismaClient; // cast for tooling/typing

    // load defs for inherited roles for the user.
    // all users inherit public permissions,
    // User.isSysadmin maps to the sysadmin role.
    const specialRoles = await db.role.findMany({
        where: {
            OR: [
                // everyone inherits the public role permissions (even non-users)
                { isPublicRole: true },
                ...(user?.isSysAdmin ? [{ isSysAdminRole: true }] : []),
                ...(user && !user.role ? [{ isRoleForNewUsers: true }] : []),
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

    // An account without an assigned role inherits the new-user role.
    const newUserRoles = specialRoles.filter(role => role.isRoleForNewUsers);
    const userHasLoginButNoRole = !!user && !user.role;
    const permsForNewUsers = newUserRoles.flatMap(role => role.permissions || []);

    // flatten all (may contain dupes)
    const entries = [
        ...(publicRole?.permissions || []),
        ...(user?.role?.permissions || []),
        ...(sysadminRole?.permissions || []),
        ...(userHasLoginButNoRole ? permsForNewUsers : []),
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

    return new PermissionSet(recognized.map(entry => entry.permission));

};

export const createPublicDataFromDatabase = async (
    db: TransactionalPrismaClient,
    args: Omit<CreatePublicDataArgs, "permissions">,
): Promise<PublicDataType> => {
    const permissions = await loadEffectivePermissions(db, args.user);
    return CreatePublicData({
        ...args,
        permissions: permissions.names,
    });
};
