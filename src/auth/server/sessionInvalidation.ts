import { Permission } from "shared/permissions";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";

export const invalidateSessionsForRolePermissionChanges = async (
    db: TransactionalPrismaClient,
    roleIds: readonly number[],
): Promise<void> => {
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) return;

    const roles = await db.role.findMany({
        where: { id: { in: uniqueRoleIds } },
        select: {
            id: true,
            isPublicRole: true,
            isSysAdminRole: true,
        },
    });

    // Public-role grants affect everyone. Sysadmin-role grants affect every
    // User.isSysAdmin principal, independently of the user's assigned role.
    if (roles.some(role => role.isPublicRole)) {
        await db.session.deleteMany({});
        return;
    }

    const assignedRoleIds = roles.map(role => role.id);
    const changesAffectSysadmins = roles.some(role => role.isSysAdminRole);

    await db.session.deleteMany({
        where: {
            user: {
                OR: [
                    ...(assignedRoleIds.length > 0
                        ? [{ roleId: { in: assignedRoleIds } }]
                        : []),
                    ...(changesAffectSysadmins ? [{ isSysAdmin: true }] : []),
                ],
            },
        },
    });
};

export const assertValidSysadminRole = async (
    db: TransactionalPrismaClient,
): Promise<void> => {
    const roles = await db.role.findMany({
        where: { isSysAdminRole: true },
        select: {
            id: true,
            name: true,
            permissions: {
                select: {
                    permission: { select: { name: true } },
                },
            },
        },
    });

    if (roles.length !== 1) {
        throw new Error(`Expected exactly one designated Sysadmin role; found ${roles.length}.`);
    }

    const role = roles[0]!;
    if (!role.permissions.some(entry => entry.permission.name === Permission.sysadmin)) {
        throw new Error(`Designated Sysadmin role "${role.name}" (#${role.id}) must grant ${Permission.sysadmin}.`);
    }
};
