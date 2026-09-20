import { Prisma } from "db";
import { defineEntity } from "../../core/db3Entity";
import { xPermission } from "../../schema/user";

export const permissionEntity = defineEntity<Prisma.PermissionDelegate>()({
    schema: xPermission,
    getIdentity: (permission: Prisma.PermissionGetPayload<{}>) => permission.id,
});
