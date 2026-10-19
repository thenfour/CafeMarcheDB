import type { Prisma } from "@prisma/client";
import { Permission } from "../../../shared/permissions";

type SysadminRoleDatabase = Pick<Prisma.TransactionClient, "globalRole" | "permission">;
type RoleConfigurationDatabase = SysadminRoleDatabase & Pick<Prisma.TransactionClient, "bandRole">;

export const assertValidSysadminRole = async (database: SysadminRoleDatabase): Promise<void> => {
    const roles = await database.globalRole.findMany({
        where: { isSysAdminRole: true, isDeleted: false },
        select: { id: true, permissions: { select: { permissionId: true } } },
    });
    if (roles.length !== 1) {
        throw new Error(`Expected exactly one active designated Sysadmin role; found ${roles.length}.`);
    }
    const role = roles[0]!;
    const requiredNames = [Permission.sysadmin, Permission.login];
    const required = await database.permission.findMany({
        where: { name: { in: requiredNames }, isDeleted: false },
        select: { id: true, name: true },
    });
    if (required.length !== requiredNames.length) {
        throw new Error("Active sysadmin and login permission definitions are required.");
    }
    const missing = required.filter(permission => !role.permissions.some(grant => grant.permissionId === permission.id));
    if (missing.length) {
        throw new Error(`The designated Sysadmin role must explicitly grant: ${missing.map(permission => permission.name).join(", ")}.`);
    }
};

export async function assertValidRoleConfiguration(database: RoleConfigurationDatabase): Promise<void> {
    await assertValidSysadminRole(database);
    const [globalPublic, globalDefault, bandPublic, bandDefault] = await Promise.all([
        database.globalRole.count({ where: { isPublicRole: true, isDeleted: false } }),
        database.globalRole.count({ where: { isRoleForNewUsers: true, isDeleted: false } }),
        database.bandRole.count({ where: { isPublicRole: true, isDeleted: false } }),
        database.bandRole.count({ where: { isRoleForNewUsers: true, isDeleted: false } }),
    ]);
    const designations = [
        { name: "Global Public", count: globalPublic },
        { name: "new-account", count: globalDefault },
        { name: "Band Public", count: bandPublic },
        { name: "new-member", count: bandDefault },
    ];
    for (const designation of designations) {
        if (designation.count !== 1) {
            throw new Error(`Expected exactly one active designated ${designation.name} role; found ${designation.count}.`);
        }
    }
}
