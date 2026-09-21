import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xPermission, xRole, xRolePermissionAssociation, xUser, xUserTag } from "../../schema/user";

export const userEntity = defineEntity<Prisma.UserDelegate>()({
    schema: xUser,
    getIdentity: (user: { id: number }) => user.id,
});

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

export const userTagEntity = defineEntity<Prisma.UserTagDelegate>()({
    schema: xUserTag,
    getIdentity: (tag: Prisma.UserTagGetPayload<{}>) => tag.id,
});
