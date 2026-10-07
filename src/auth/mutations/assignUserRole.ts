import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { isPublicId, type RolePublicId } from "shared/publicId";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export const AssignUserRoleInput = z.object({
    userId: UserPublicIdSchema,
    roleId: z.custom<RolePublicId>(isPublicId).nullable(),
    acknowledgeContinuityRisk: z.boolean().default(false),
}).strict();

export default resolver.pipe(
    resolver.zod(AssignUserRoleInput),
    resolver.authorize(Permission.login),
    async () => requireRestoredApplicationFeature("accountRoles"),
);


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/mutations/assignUserRole.ts:1-100
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 6eebc147f48611de9936fd7bab91bf7901a526eeb70fd70a87f2787d4fd7da74
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import { NotFoundError } from "blitz";
// import db, { Prisma } from "db";
// import {
//     ChangeAction,
//     CreateChangeContext,
//     RegisterChange,
// } from "@/src/auth/server/activityLog";
// import { Permission } from "shared/permissions";
// import { cmauthorize } from "../server/cmResolver";
// import { z } from "zod";
// import { isPublicId, type RolePublicId } from "shared/publicId";
// import {
//     requireCanManageUser,
//     requireContinuityAcknowledgement,
// } from "../server/userManagementPolicy";
// import {
//     findUserManagementActor,
//     findUserManagementTargetByPublicId,
//     findUserManagementRole,
//     getUserManagementContinuityWarnings,
//     makePermissionSetFromRole,
// } from "../server/userManagementState";
// import { PermissionSet } from "../shared/PermissionSet";
// import { UserPublicIdSchema } from "../schemas";
//
// export const AssignUserRoleInput = z.object({
//     userId: UserPublicIdSchema,
//     roleId: z.custom<RolePublicId>(isPublicId).nullable(),
//     acknowledgeContinuityRisk: z.boolean().default(false),
// });
//
// export default resolver.pipe(
//     resolver.zod(AssignUserRoleInput),
//     cmauthorize(Permission.assign_user_roles),
//     async ({ userId, roleId, acknowledgeContinuityRisk }, ctx) => db.$transaction(
//         async tx => {
//             // desiredRole perm set is NOT "effective" perms, on purpose.
//             // we only care about perms under the assigning role.
//
//             // resolve public id just resolves an ID, it doesn't return the full row; this is intentional.
//             const desiredRoleIdentity = roleId == null
//                 ? null
//                 : await tx.role.findUnique({
//                     where: { publicId: roleId },
//                     select: { id: true },
//                 });
//             const desiredRoleDatabaseId = desiredRoleIdentity?.id ?? null;
//             const [actor, target, desiredRole] = await Promise.all([
//                 findUserManagementActor(tx, ctx.session.userId),
//                 findUserManagementTargetByPublicId(tx, userId),
//                 findUserManagementRole(tx, desiredRoleDatabaseId),
//             ]);
//
//             if (!target) throw new NotFoundError();
//             if (roleId != null && !desiredRole) throw new NotFoundError();
//
//             const desiredRolePerms = desiredRole ? makePermissionSetFromRole(desiredRole) : new PermissionSet([]);
//
//             requireCanManageUser({
//                 actor,
//                 target,
//                 action: "assignRole",
//                 desiredRole: desiredRolePerms,
//             });
//
//             if (target.principal.roleId === desiredRoleDatabaseId) {
//                 return { userId, roleId, continuityWarnings: [] };
//             }
//
//             const continuityWarnings = await getUserManagementContinuityWarnings(
//                 tx,
//                 target,
//                 desiredRolePerms,
//             );
//             requireContinuityAcknowledgement(
//                 continuityWarnings,
//                 acknowledgeContinuityRisk,
//             );
//
//             await tx.user.update({
//                 where: { id: target.principal.id },
//                 data: { roleId: desiredRoleDatabaseId },
//             });
//             await RegisterChange({
//                 action: ChangeAction.update,
//                 changeContext: CreateChangeContext("assignUserRole"),
//                 table: "User",
//                 pkid: target.principal.id,
//                 oldValues: { roleId: target.principal.roleId },
//                 newValues: { roleId: desiredRoleDatabaseId },
//                 auth: ctx.auth,
//                 db: tx,
//             });
//
//             return { userId, roleId, continuityWarnings };
//         },
//         { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
//     ),
// );
// MIGRATION_REFERENCE_END
