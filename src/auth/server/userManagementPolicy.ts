import { AuthorizationError } from "blitz";
import {
    gContinuitySensitivePermissions,
    gPermissionOrdered,
    Permission,
} from "shared/permissions";
import { PermissionSet } from "../shared/PermissionSet";

export type UserManagementAction =
    | "merge"
    | "manageSignInMethods"
    | "assignRole"
    | "correctEmail"
    | "deactivate"
    | "reactivate"
    | "impersonate"
    | "resetPassword"
    | "setSysAdmin";

// user metadata relevant for management decisions
export type UserManagementPrincipal = {
    id: number;
    email: string;
    roleId: number | null;
    isSysAdmin: boolean;
    isDeleted?: boolean;
    mergedIntoUserId?: number | null;
};

export type UserManagementActor = {
    principal: UserManagementPrincipal | null; //  null = unauthenticated user / anonymous
    effectivePermissions: PermissionSet;
};

// why do we need permissions of the target?
// to be able to test if they're in your delegable permission envelope.
export type UserManagementTarget = {
    principal: UserManagementPrincipal;
    rolePermissions: PermissionSet;
};

export type UserManagementSubject = UserManagementTarget;

export interface CanManageUserArgs {
    actor: UserManagementActor; // non-nullable; anon still get an effective set of permissions.
    target: UserManagementTarget;
    action: UserManagementAction;

    // which role are you assigning, if applicable.
    // why is this needed? to decide if the actor is allowed to assign that role.
    //
    // Undefined means "is any role assignment available?" for UI capability
    // decisions. A concrete mutation must supply the selected role or null.
    desiredRole?: PermissionSet;
}

export interface UserManagementCapabilities {
    canMerge: boolean;
    canManageSignInMethods: boolean;
    canAssignRole: boolean;
    canCorrectEmail: boolean;
    canDeactivate: boolean;
    canReactivate: boolean;
    canImpersonate: boolean;
    canResetPassword: boolean;
    canSetSysAdmin: boolean;
}

// determines if the given role falls within the
// actor's delegable permission envelope.
// for example if the actor is a band admin
// - if role is outside the delegable envelope, like a sysadmin role, the answer is: no.
// - if role is within, like a regular member role, the answer is: yes.
export const isRoleWithinDelegationEnvelope = (
    actor: UserManagementActor,
    role: PermissionSet,
): boolean => {
    return actor.effectivePermissions.hasAllDelegable(role);
};

// This is an additional target/ceiling policy. Existing endpoint, table, row,
// and field authorization remains mandatory and may be more restrictive.
export const canManageUser = ({ actor, target, action, desiredRole }: CanManageUserArgs): boolean => {
    if (actor.principal?.isDeleted) {
        return false; // deleted users can't act.
    }
    const actorIsSysadmin = actor.effectivePermissions.includesName(Permission.sysadmin);

    if (target.principal.mergedIntoUserId != null) {
        return false;
    }

    if (action === "merge") {
        return actor.effectivePermissions.includesName(Permission.merge_users)
            && actor.principal?.id !== target.principal.id
            && (!target.principal.isDeleted || actor.effectivePermissions.includesName(Permission.recover_users))
            && (actorIsSysadmin || isRoleWithinDelegationEnvelope(actor, target.rolePermissions));
    }

    if (action === "manageSignInMethods" || action === "correctEmail") {
        return actorIsSysadmin;
    }

    if (action === "reactivate") {
        return target.principal.isDeleted === true
            && actor.effectivePermissions.includesName(Permission.recover_users)
            && (actorIsSysadmin || isRoleWithinDelegationEnvelope(actor, target.rolePermissions));
    }

    if (target.principal.isDeleted === true) {
        return false;
    }

    if (action === "setSysAdmin") {
        return actorIsSysadmin;
    }

    // The current administrator-mediated reset URL is an account-takeover
    // credential and remains a Sysadmin-only operation.
    //
    // TODO: consider making this a configurable permission. some work is to be done
    // to harden the process (shorter expiry, hide reset URL from screen by default,
    // find other channels to communicate reset URL, multi-factor authorize the reset)
    if (action === "resetPassword") {
        return actorIsSysadmin;
    }

    // Impersonation is controlled by its dedicated capability and cannot target oneself.
    if (action === "impersonate") {
        return actor.effectivePermissions.includesName(Permission.impersonate_user)
            && actor.principal?.id !== target.principal.id;
    }

    if (actorIsSysadmin) {
        return true;
    }

    if (action === "assignRole") {
        if (!actor.effectivePermissions.includesName(Permission.assign_user_roles)) return false;
        if (!isRoleWithinDelegationEnvelope(actor, target.rolePermissions)) return false;
        if (desiredRole !== undefined && !isRoleWithinDelegationEnvelope(actor, desiredRole)) return false;
        return true;
    }

    if (action === "deactivate") {
        return actor.effectivePermissions.includesName(Permission.deactivate_users);
    }

    // edit not handled here; DB3 handles normal table mutations of users;
    // field edits are not considered "management actions".
    throw new Error(`Unhandled action: ${action}`);
};

export const getUserManagementCapabilities = (
    actor: UserManagementActor,
    target: UserManagementTarget,
): UserManagementCapabilities => ({
    canMerge: canManageUser({ actor, target, action: "merge" }),
    canManageSignInMethods: canManageUser({ actor, target, action: "manageSignInMethods" }),
    canAssignRole: canManageUser({ actor, target, action: "assignRole" }),
    canCorrectEmail: canManageUser({ actor, target, action: "correctEmail" }),
    canDeactivate: canManageUser({ actor, target, action: "deactivate" }),
    canReactivate: canManageUser({ actor, target, action: "reactivate" }),
    canImpersonate: canManageUser({ actor, target, action: "impersonate" }),
    canResetPassword: canManageUser({ actor, target, action: "resetPassword" }),
    canSetSysAdmin: canManageUser({ actor, target, action: "setSysAdmin" }),
});

export const getContinuityWarningsForUserResult = (
    target: UserManagementTarget,
    resultingRole: PermissionSet,
    activeNonSysadminUsers: readonly UserManagementSubject[],
): Permission[] => {
    if (target.principal.isDeleted === true || target.principal.isSysAdmin) return [];
    const principalId = target.principal.id;

    return gPermissionOrdered.filter(permission => {
        if (!gContinuitySensitivePermissions.has(permission)) return false;
        if (!target.rolePermissions.includesName(permission)) return false;
        if (resultingRole.includesName(permission)) return false;

        return !activeNonSysadminUsers.some(user => (
            user.principal.id !== principalId
            && user.principal.isDeleted !== true
            && !user.principal.isSysAdmin
            && user.rolePermissions.includesName(permission)
        ));
    });
};

// would prefer to use a structured reply, but this is sent to client, not just a
// in-thread exception, where an error is appropriate.
export const kContinuityAcknowledgementErrorPrefix = "CONTINUITY_ACKNOWLEDGEMENT_REQUIRED:";

export class UserManagementContinuityError extends Error {
    constructor(public readonly permissions: readonly Permission[]) {
        super(`${kContinuityAcknowledgementErrorPrefix}${permissions.join(",")}`);
        this.name = "UserManagementContinuityError";
    }
}

export const requireContinuityAcknowledgement = (
    permissions: readonly Permission[],
    acknowledged: boolean,
): void => {
    if (permissions.length > 0 && !acknowledged) {
        throw new UserManagementContinuityError(permissions);
    }
};

export class UserManagementAuthorizationError extends AuthorizationError {
    constructor(action: UserManagementAction) {
        super();
        this.message = `Not authorized to ${action} this user.`;
        this.name = "UserManagementAuthorizationError";
    }
}

export const requireCanManageUser = (args: CanManageUserArgs): void => {
    if (!canManageUser(args)) {
        throw new UserManagementAuthorizationError(args.action);
    }
};
