import { PrismaClient } from "@/db";
import { Permission } from "shared/permissions";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

export const assertIsPrismaClient = (db: unknown): asserts db is PrismaClient => {
    // no check necessary; the type assertion is sufficient.
};

export const assertValidSysadminRole = async (
    db: TransactionalPrismaClient,
): Promise<void> => {
    const db2 = db as PrismaClient;
    const roles = await db2.role.findMany({
        where: { isSysAdminRole: true },
        select: {
            id: true,
            name: true,
            permissions: {
                select: {
                    permission: { select: { name: true, id: true, } },
                },
            },
        },
    });

    if (roles.length !== 1) {
        throw new Error(`Expected exactly one designated Sysadmin role; found ${roles.length}.`);
    }

    const role = roles[0]!;

    // for missing permissions, need this list.
    const allPermissions = await db2.permission.findMany();

    const requiredPerms = [Permission.sysadmin, Permission.login]
        .map(permName => allPermissions.find(p => p.name === permName))
        .filter(Boolean) as typeof allPermissions;

    // remove perms already assigned to the role.
    const permsToAdd = requiredPerms
        .filter(perm => !role.permissions.some(entry => entry.permission.id === perm.id));

    if (permsToAdd.length > 0) {
        await db2.rolePermission.createMany({
            data: permsToAdd.map(perm => ({
                roleId: role.id,
                permissionId: perm.id,
            })),
        });
    }
};
