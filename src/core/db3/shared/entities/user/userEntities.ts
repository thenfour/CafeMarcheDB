import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xPermission, xRole, xRolePermissionAssociation } from "../../schema/user";

export const permissionEntity = defineEntity<Prisma.PermissionDelegate>()({
    schema: xPermission,
    getIdentity: (permission: Prisma.PermissionGetPayload<{}>) => permission.id,
});

export const roleEntity = defineEntity<Prisma.RoleDelegate>()({
    schema: xRole,
    getIdentity: (role: Prisma.RoleGetPayload<{}>) => role.id,
});

export const rolePermissionEntity = defineEntity<Prisma.RolePermissionDelegate>()({
    schema: xRolePermissionAssociation,
    getIdentity: (rolePermission: Prisma.RolePermissionGetPayload<{}>) => rolePermission.id,
});
