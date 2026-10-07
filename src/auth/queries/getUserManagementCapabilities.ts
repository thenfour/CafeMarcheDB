import { resolver } from "@blitzjs/rpc";
import { AuthorizationError, NotFoundError } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import {
    getContinuityWarningsForUserResult,
    getUserManagementCapabilities,
} from "../server/userManagementPolicy";
import {
    findActiveNonSysadminUsers,
    findUserManagementActor,
    findUserManagementTargetByPublicId,
} from "../server/userManagementState";
import { PermissionSet } from "../shared/PermissionSet";

const GetUserManagementCapabilitiesInput = z.object({
    userId: UserPublicIdSchema,
});

export default resolver.pipe(
    resolver.zod(GetUserManagementCapabilitiesInput),
    resolver.authorize(Permission.view_users_basic_info),
    async ({ userId }, ctx) => {
        const [actor, target] = await Promise.all([
            findUserManagementActor(db, ctx.session.userId),
            findUserManagementTargetByPublicId(db, userId),
        ]);

        if (!target) {
            throw new NotFoundError();
        }
        if (target.principal.isDeleted
            && !actor.auth.hasPermission(Permission.recover_users)) {
            // target user is deleted.
            // deleted users are only known through Permission.recover_users
            throw new AuthorizationError();
        }
        const capabilities = getUserManagementCapabilities(actor, target);
        const activeNonSysadminUsers = capabilities.canDeactivate
            ? await findActiveNonSysadminUsers(db)
            : [];

        return {
            ...capabilities,
            // These account-wide workflows have no migrated implementation yet.
            canAssignRole: false,
            canMerge: false,
            mergedIntoUserId: target.principal.mergedIntoUserId == null ? null : (await db.user.findUnique({
                where: { id: target.principal.mergedIntoUserId },
                select: { publicId: true },
            }))?.publicId ?? null,
            deactivationContinuityWarnings: capabilities.canDeactivate
                ? getContinuityWarningsForUserResult(target, new PermissionSet([]), activeNonSysadminUsers)
                : [],
        };
    },
);


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/queries/getUserManagementCapabilities.ts:1-64
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 671905ec2da9afa071b6eb530b1adda0236b1ba50c0ae5dc4b7f684143174061
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import { AuthorizationError, NotFoundError } from "blitz";
// import db from "db";
// import { Permission } from "shared/permissions";
// import { z } from "zod";
// import { UserPublicIdSchema } from "../schemas";
// import {
//     getContinuityWarningsForUserResult,
//     getUserManagementCapabilities,
// } from "../server/userManagementPolicy";
// import {
//     findActiveNonSysadminUsers,
//     findUserManagementActor,
//     findUserManagementTargetByPublicId,
//     getAssignableRoles,
// } from "../server/userManagementState";
// import { PermissionSet } from "../shared/PermissionSet";
//
// const GetUserManagementCapabilitiesInput = z.object({
//     userId: UserPublicIdSchema,
// });
//
// export default resolver.pipe(
//     resolver.zod(GetUserManagementCapabilitiesInput),
//     resolver.authorize(Permission.view_users_basic_info),
//     async ({ userId }, ctx) => {
//         const [actor, target] = await Promise.all([
//             findUserManagementActor(db, ctx.session.userId),
//             findUserManagementTargetByPublicId(db, userId),
//         ]);
//
//         if (!target) throw new NotFoundError();
//         if (target.principal.isDeleted
//             && !actor.auth.hasPermission(Permission.recover_users)) {
//             // target user is deleted.
//             // deleted users are only known through Permission.recover_users
//             throw new AuthorizationError();
//         }
//         const capabilities = getUserManagementCapabilities(actor, target);
//         const activeNonSysadminUsers = capabilities.canAssignRole || capabilities.canDeactivate
//             ? await findActiveNonSysadminUsers(db)
//             : [];
//
//         return {
//             ...capabilities,
//             mergedIntoUserId: target.principal.mergedIntoUserId == null ? null : (await db.user.findUnique({
//                 where: { id: target.principal.mergedIntoUserId },
//                 select: { publicId: true },
//             }))?.publicId ?? null,
//             assignableRoles: await getAssignableRoles(
//                 db,
//                 actor,
//                 target,
//                 activeNonSysadminUsers,
//             ),
//             unassignedRoleContinuityWarnings: capabilities.canAssignRole
//                 ? getContinuityWarningsForUserResult(target, new PermissionSet([]), activeNonSysadminUsers)
//                 : [],
//             deactivationContinuityWarnings: capabilities.canDeactivate
//                 ? getContinuityWarningsForUserResult(target, new PermissionSet([]), activeNonSysadminUsers)
//                 : [],
//         };
//     },
// );
// MIGRATION_REFERENCE_END
