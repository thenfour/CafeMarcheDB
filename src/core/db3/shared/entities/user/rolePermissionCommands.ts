import { defineAssociationCommand } from "../../core/db3AssociationCommand";
import { xPermission } from "../../schema/user";
import { xBandRole } from "./bandRoleViews";
import { xGlobalRole } from "./roleViews";

export const setGlobalRolePermissionCommand = defineAssociationCommand({
    commandID: "GlobalRolePermission_Set",
    localEntity: xPermission,
    foreignEntity: xGlobalRole,
    localIdentitySchema: xPermission.identitySchema,
    foreignIdentitySchema: xGlobalRole.identitySchema,
    additionalInvalidationEntityIDs: ["GlobalRolePermission"],
});
export const setBandRolePermissionCommand = defineAssociationCommand({
    commandID: "BandRolePermission_Set",
    localEntity: xPermission,
    foreignEntity: xBandRole,
    localIdentitySchema: xPermission.identitySchema,
    foreignIdentitySchema: xBandRole.identitySchema,
    additionalInvalidationEntityIDs: ["BandRolePermission"],
});
