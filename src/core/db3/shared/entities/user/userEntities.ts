import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xPermission, xRole, xRolePermissionAssociation, xUser, xUserTag } from "../../schema/user";

export const userEntity = defineEntity<Prisma.UserDelegate>()({
    schema: xUser,
});

export const permissionEntity = defineEntity<Prisma.PermissionDelegate>()({
    schema: xPermission,
});

export const roleEntity = defineEntity<Prisma.RoleDelegate>()({
    schema: xRole,
});

export const rolePermissionEntity = defineEntity<Prisma.RolePermissionDelegate>()({
    schema: xRolePermissionAssociation,
});

export const userTagEntity = defineEntity<Prisma.UserTagDelegate>()({
    schema: xUserTag,
});
