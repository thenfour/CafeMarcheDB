import { NotFoundError } from "blitz";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import { executeDB3Read, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { globalRoleListView, xGlobalRole } from "src/core/db3/shared/entities/user/roleViews";
import { canManageUser } from "./userManagementPolicy";
import type { CMServerAuthorization } from "./serverAuthorization";
import { getContinuityWarningsForUserResult, evaluateUserManagementCapabilities, type UserManagementActor } from "./userManagementPolicy";
import { findActiveNonSysadminUsers, findUserManagementTargetByPublicId, makePermissionSetFromRole } from "./userManagementState";
import { PermissionSet } from "../shared/PermissionSet";
import { canMergeAccount } from "./userMerge/mergeEligibility";
import { mergeUserInclude } from "./userMerge/types";

export function readUserManagementCapabilities(database: DB3ReadDatabase, authorization: CMServerAuthorization, userId: UserPublicId, locale: LocalePreferenceInput) {
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization.requireUser();
        // Account controls use platform authority regardless of the caller's selected band.
        const actor: UserManagementActor = { principal: auth.user, auth };
        const target = await findUserManagementTargetByPublicId(context.database, userId);
        if (!target) {
            throw new NotFoundError();
        }
        const capabilities = evaluateUserManagementCapabilities(actor, target);
        const roles = capabilities.canAssignRole ? await context.database.globalRole.findMany({
            where: { isDeleted: false },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            },
        }) : [];

        const assignableIds = roles.filter(role => canManageUser({ actor, target, action: "assignRole", desiredRole: makePermissionSetFromRole(role) }))
            .map(role => xGlobalRole.parseIdentity(role.publicId));
        const assignableRoles = assignableIds.length === 0 ? [] : (await queryView(
            {
                ...locale,
                view: globalRoleListView,
                filter: { publicIds: assignableIds },
                cmdbQueryContext: "account role choices",
            },
            auth,
            context)).items;

        const currentRole = capabilities.canAssignRole ? await context.database.user.findUniqueOrThrow({
            where: { id: target.principal.id },
            select: {
                globalRole: {
                    select: {
                        publicId: true
                    }
                }
            },
        }) : null;
        const activeUsers = capabilities.canDeactivate ? await findActiveNonSysadminUsers(context.database) : [];
        const replacement = target.principal.mergedIntoUserId == null ? null : await context.database.user.findUnique({
            where: { id: target.principal.mergedIntoUserId },
            select: { publicId: true },
        });
        const mergeTarget = capabilities.canMerge ? await context.database.user.findUniqueOrThrow({
            where: { id: target.principal.id }, include: mergeUserInclude,
        }) : null;
        return {
            ...capabilities,
            canMerge: mergeTarget !== null && canMergeAccount(actor, mergeTarget),
            currentRoleId: currentRole?.globalRole ? xGlobalRole.parseIdentity(currentRole.globalRole.publicId) : null,
            assignableRoles,
            mergedIntoUserId: replacement ? parsePublicId<"User">(replacement.publicId) : null,
            deactivationContinuityWarnings: capabilities.canDeactivate
                ? getContinuityWarningsForUserResult(target, new PermissionSet([]), activeUsers) : [],
        };
    });
}
