import type { Prisma } from "@prisma/client";
import { Permission } from "../../../shared/permissions";
import { generatePublicId } from "../../server/publicId";

type SysadminRoleDatabase = Pick<Prisma.TransactionClient, "globalRole" | "permission" | "globalRolePermission">;

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
        await database.globalRolePermission.createMany({
            data: missing.map(permission => ({
                publicId: generatePublicId<"GlobalRolePermission">(),
                globalRoleId: role.id, permissionId: permission.id,
            })),
        });
    }
};
