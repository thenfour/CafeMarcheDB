import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";

const assignedSysadminRoleWhere = Prisma.validator<Prisma.UserWhereInput>()({
    globalRole: {
        isDeleted: false,
        permissions: { some: { permission: { name: Permission.sysadmin, isDeleted: false } } },
    },
});

/** SQL classifications use the same assigned-or-Public global role as authorization. */
export async function loadPlatformSysadminWhere(database: Pick<Prisma.TransactionClient, "globalRole">): Promise<Prisma.UserWhereInput> {
    const roles = await database.globalRole.findMany({
        where: { isPublicRole: true, isDeleted: false },
        select: { permissions: {
            select: { permission: { select: { name: true, isDeleted: true } } },
        } },
    });
    const publicRole = roles[0];
    if (roles.length !== 1 || !publicRole) {
        throw new Error("Authorization requires exactly one active Public global role.");
    }
    const publicIsSysadmin = publicRole.permissions.some(grant => !grant.permission.isDeleted && grant.permission.name === Permission.sysadmin);
    return !publicIsSysadmin ? assignedSysadminRoleWhere : {
        OR: [assignedSysadminRoleWhere, { globalRoleId: null }],
    };
}
