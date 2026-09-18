import { resolver } from "@blitzjs/rpc";
import { AuthorizationError, NotFoundError } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import {
    getContinuityWarningsForUserResult,
    getUserManagementCapabilities,
} from "../server/userManagementPolicy";
import {
    findActiveNonSysadminUsers,
    findUserManagementActor,
    findUserManagementTarget,
    getAssignableRoles,
} from "../server/userManagementState";
import { PermissionSet } from "../shared/PermissionSet";

const GetUserManagementCapabilitiesInput = z.object({
    userId: z.number().int().positive(),
});

export default resolver.pipe(
    resolver.zod(GetUserManagementCapabilitiesInput),
    resolver.authorize(Permission.view_users_basic_info),
    async ({ userId }, ctx) => {
        const [actor, target] = await Promise.all([
            findUserManagementActor(db, ctx.session.userId),
            findUserManagementTarget(db, userId),
        ]);

        if (!target) throw new NotFoundError();
        if (target.principal.isDeleted
            && !actor.effectivePermissions.includesName(Permission.recover_users)) {
            // target user is deleted.
            // deleted users are only known through Permission.recover_users
            throw new AuthorizationError();
        }
        const capabilities = getUserManagementCapabilities(actor, target);
        const activeNonSysadminUsers = capabilities.canAssignRole || capabilities.canDeactivate
            ? await findActiveNonSysadminUsers(db)
            : [];

        return {
            ...capabilities,
            mergedIntoUserId: target.principal.mergedIntoUserId,
            assignableRoles: await getAssignableRoles(
                db,
                actor,
                target,
                activeNonSysadminUsers,
            ),
            unassignedRoleContinuityWarnings: capabilities.canAssignRole
                ? getContinuityWarningsForUserResult(target, new PermissionSet([]), activeNonSysadminUsers)
                : [],
            deactivationContinuityWarnings: capabilities.canDeactivate
                ? getContinuityWarningsForUserResult(target, new PermissionSet([]), activeNonSysadminUsers)
                : [],
        };
    },
);
