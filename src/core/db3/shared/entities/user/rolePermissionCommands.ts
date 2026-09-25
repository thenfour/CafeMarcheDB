import { defineAssociationCommand } from "../../core/db3AssociationCommand";
import {
    xPermission,
    xRole,
    xRolePermissionAssociation,
} from "../../schema/user";

export const setRolePermissionCommand = defineAssociationCommand({
    commandID: "RolePermission_Set",
    localEntity: xPermission,
    foreignEntity: xRole,
    localIdentitySchema: xPermission.identitySchema,
    foreignIdentitySchema: xRole.identitySchema,
    additionalInvalidationEntityIDs: [xRolePermissionAssociation.tableID],
});
