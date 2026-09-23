import { z } from "zod";
import { defineAssociationCommand } from "../../core/db3AssociationCommand";
import {
    xPermission,
    xRole,
    xRolePermissionAssociation,
} from "../../schema/user";

const NaturalIdSchema = z.number().int().positive();

export const setRolePermissionCommand = defineAssociationCommand({
    commandID: "RolePermission_Set",
    localEntity: xPermission,
    foreignEntity: xRole,
    localIdentitySchema: NaturalIdSchema,
    foreignIdentitySchema: NaturalIdSchema,
    additionalInvalidationEntityIDs: [xRolePermissionAssociation.tableID],
});
