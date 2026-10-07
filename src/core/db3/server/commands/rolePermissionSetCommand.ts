// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/server/commands/rolePermissionSetCommand.ts:1-66
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 01e34cb7f0f2c33f6e5c73ef689d8d15ecf4abff2c45de710d966ed47ac6f0a6
// MIGRATION_REFERENCE_BEGIN
// import {
//     xPermission,
//     xRole,
//     setRolePermissionCommand,
// } from "../../db3";
// import { defineCommandHandler } from "../db3CommandCore";
//
// // server-side handler for setRolePermissionCommand
// export const rolePermissionSetCommandHandler = defineCommandHandler(
//     setRolePermissionCommand,
//     async (dto, context) => {
//         const permission = await context.rowServices.requireVisible(
//             xPermission,
//             dto.localIdentity,
//         );
//         const role = await context.rowServices.requireVisible(
//             xRole,
//             dto.foreignIdentity,
//         );
//         const permissionId = xPermission.parseDatabaseIdentity(permission[xPermission.pkMember]);
//         const roleId = xRole.parseDatabaseIdentity(role[xRole.pkMember]);
//         const rolePublicId = xRole.parseIdentity(role[xRole.clientIdMember]);
//
//         // fetch associations for this permission
//         const currentAssociations = await context.transaction.rolePermission.findMany({
//             where: { permissionId },
//             select: { roleId: true },
//         });
//         // fetch the current roles associated with this permission
//         const currentRoles = await context.transaction.role.findMany({
//             where: { id: { in: currentAssociations.map(association => association.roleId) } },
//             select: { id: true, publicId: true },
//         });
//
//         // make a map of DB ID -> public ID.
//         // the later update() call wants  public ids, not database ids.
//         const currentRolePublicIdsByDatabaseId = new Map(currentRoles.map(currentRole => [
//             xRole.parseDatabaseIdentity(currentRole.id),
//             xRole.parseIdentity(currentRole.publicId),
//         ]));
//         const getCurrentRolePublicId = (currentRoleId: number) => {
//             const publicId = currentRolePublicIdsByDatabaseId.get(currentRoleId);
//             if (!publicId) {
//                 throw new Error(`RolePermission references missing Role ${currentRoleId}.`);
//             }
//             return publicId;
//         };
//         const currentRolePublicIds = currentAssociations.map(association => (
//             getCurrentRolePublicId(association.roleId)
//         ));
//         const desiredRolePublicIds = dto.isAssociated
//             ? [...new Set([...currentRolePublicIds, rolePublicId])]
//             : currentAssociations
//                 .filter(association => association.roleId !== roleId)
//                 .map(association => getCurrentRolePublicId(association.roleId));
//
//         // Use the parent association field so its field/row authorization,
//         // auditing, and RolePermission mutation hooks remain authoritative.
//         await context.rowServices.update(
//             xPermission,
//             dto.localIdentity,
//             { roles: desiredRolePublicIds },
//         );
//         return dto;
//     },
// );
// MIGRATION_REFERENCE_END
