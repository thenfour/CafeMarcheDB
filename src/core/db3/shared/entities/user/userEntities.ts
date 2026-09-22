import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import {
    xPermission,
    xRole,
    xRolePermissionAssociation,
    xUser,
    xUserInstrument,
    xUserTag,
} from "../../schema/user";

export const userEntity = defineEntity({
    schema: xUser,
    getIdentity: (user: { id: number }) => user.id,
});

export const userInstrumentEntity = defineEntity({
    schema: xUserInstrument,
    getIdentity: (association: { id: number }) => association.id,
});

export const permissionEntity = defineEntity({
    schema: xPermission,
    getIdentity: (permission: Prisma.PermissionGetPayload<{}>) => permission.id,
});

export const roleEntity = defineEntity({
    schema: xRole,
    getIdentity: (role: Prisma.RoleGetPayload<{}>) => role.id,
});

export const rolePermissionEntity = defineEntity({
    schema: xRolePermissionAssociation,
    getIdentity: (rolePermission: Prisma.RolePermissionGetPayload<{}>) => rolePermission.id,
});

export const userTagEntity = defineEntity({
    schema: xUserTag,
    getIdentity: (tag: Prisma.UserTagGetPayload<{}>) => tag.id,
});
