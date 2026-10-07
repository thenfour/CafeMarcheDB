// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/entities/user/rolePermissionCommands.ts:1-15
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: b67a0d1fda641114f86762a0a70abf15d6022fa4c12d9422424664a9c16ee0fa
// MIGRATION_REFERENCE_BEGIN
// import { defineAssociationCommand } from "../../core/db3AssociationCommand";
// import {
//     xPermission,
//     xRole,
//     xRolePermissionAssociation,
// } from "../../schema/user";
//
// export const setRolePermissionCommand = defineAssociationCommand({
//     commandID: "RolePermission_Set",
//     localEntity: xPermission,
//     foreignEntity: xRole,
//     localIdentitySchema: xPermission.identitySchema,
//     foreignIdentitySchema: xRole.identitySchema,
//     additionalInvalidationEntityIDs: [xRolePermissionAssociation.tableID],
// });
// MIGRATION_REFERENCE_END
