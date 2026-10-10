import { NotFoundError } from "blitz";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import type { CMServerAuthorization } from "./serverAuthorization";
import { getContinuityWarningsForUserResult, evaluateUserManagementCapabilities, type UserManagementActor } from "./userManagementPolicy";
import { findActiveNonSysadminUsers, findUserManagementTargetByPublicId } from "./userManagementState";
import { PermissionSet } from "../shared/PermissionSet";

export function readUserManagementCapabilities(database: DB3ReadDatabase, authorization: CMServerAuthorization, userId: UserPublicId) {
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization.requireUser();
        // Account controls use platform authority regardless of the caller's selected band.
        const actor: UserManagementActor = { principal: auth.user, auth };
        const target = await findUserManagementTargetByPublicId(context.database, userId);
        if (!target) {
            throw new NotFoundError();
        }
        const capabilities = evaluateUserManagementCapabilities(actor, target);
        const activeUsers = capabilities.canDeactivate ? await findActiveNonSysadminUsers(context.database) : [];
        const replacement = target.principal.mergedIntoUserId == null ? null : await context.database.user.findUnique({
            where: { id: target.principal.mergedIntoUserId }, select: { publicId: true },
        });
        return {
            ...capabilities,
            // Account role assignment and merging retain their separate restoration obligations.
            canAssignRole: false, canMerge: false,
            mergedIntoUserId: replacement ? parsePublicId<"User">(replacement.publicId) : null,
            deactivationContinuityWarnings: capabilities.canDeactivate
                ? getContinuityWarningsForUserResult(target, new PermissionSet([]), activeUsers) : [],
        };
    });
}
