import type { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";

/** Creation stores the configured role; authorization never reads this designation. */
export async function loadDefaultAccountRole(database: Pick<Prisma.TransactionClient, "globalRole">) {
    const roles = await database.globalRole.findMany({
        where: { isRoleForNewUsers: true, isDeleted: false },
        select: {
            id: true,
            permissions: { select: { permission: { select: { name: true, isDeleted: true } } } },
        },
    });
    const role = roles[0];
    if (roles.length !== 1 || !role) {
        throw new Error("Account creation requires exactly one active role for new accounts.");
    }
    return {
        id: role.id,
        isSysAdmin: role.permissions.some(grant => !grant.permission.isDeleted && grant.permission.name === Permission.sysadmin),
    };
}
