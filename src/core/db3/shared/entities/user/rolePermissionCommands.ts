import { z } from "zod";
import { defineAssociationCommand } from "../../core/db3AssociationCommand";
import {
    permissionEntity,
    roleEntity,
    rolePermissionEntity,
} from "./userEntities";

const NaturalIdSchema = z.number().int().positive();

export const setRolePermissionCommand = defineAssociationCommand({
    commandID: "RolePermission_Set",
    localEntity: permissionEntity,
    foreignEntity: roleEntity,
    localIdentitySchema: NaturalIdSchema,
    foreignIdentitySchema: NaturalIdSchema,
    additionalInvalidationEntityIDs: [rolePermissionEntity.entityID],
});
