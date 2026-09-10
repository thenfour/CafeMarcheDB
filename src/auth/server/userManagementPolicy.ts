import { AuthorizationError } from "blitz";
import {
    getPermissionDefinition,
    gContinuitySensitivePermissions,
    gPermissionOrdered,
    gProtectedPermissions,
    gPublicPermissions,
    isPermission,
    Permission,
} from "shared/permissions";

export type UserManagementAction =
    | "assignRole"
    | "deactivate"
    | "edit"
    | "impersonate"
    | "resetPassword"
    | "setSysAdmin";

type PermissionEntry = {
    permission?: {
        name?: string | null;
    } | null;
};

export type UserManagementRole = {
    permissions?: readonly PermissionEntry[];
} | null;



// user metadata relevant for management decisions
export type UserManagementPrincipal = {
    id: number;
    isSysAdmin: boolean;
    isDeleted?: boolean;
    role?: UserManagementRole;
};

export interface CanManageUserArgs {
    actor: UserManagementPrincipal | null;
    target: UserManagementPrincipal;
    action: UserManagementAction;
    // Undefined means "is any role assignment available?" for UI capability
    // decisions. A concrete mutation must supply the selected role or null.
    desiredRole?: UserManagementRole;
}

export interface UserManagementCapabilities {
    canAssignRole: boolean;
    canDeactivate: boolean;
    canEdit: boolean;
    canImpersonate: boolean;
    canResetPassword: boolean;
    canSetSysAdmin: boolean;
}

export const roleHasPermission = (role: UserManagementRole | undefined, permission: Permission): boolean => (
    role?.permissions?.some(entry => entry.permission?.name === permission) || false
);

const getActorPermissionNames = (actor: UserManagementPrincipal): ReadonlySet<string> => new Set([
    ...gPublicPermissions,
    ...(actor.role?.permissions
        ?.map(entry => entry.permission?.name)
        .filter((name): name is string => !!name) || []),
]);

// determines if the given role falls within the
// actor's delegable permission envelope.
// for example if the actor is a band admin
// - if role is outside the delegable envelope, like a sysadmin role, the answer is: no.
// - if role is within, like a regular member role, the answer is: yes.
export const isRoleWithinDelegationEnvelope = (
    actor: UserManagementPrincipal,
    role: UserManagementRole | undefined,
): boolean => {
    if (actor.isSysAdmin) return true;

    const actorPermissions = getActorPermissionNames(actor);
    return role?.permissions?.every(entry => {
        const permissionName = entry.permission?.name;
        if (!permissionName || !isPermission(permissionName)) return false;
        return getPermissionDefinition(permissionName).isDelegable
            && actorPermissions.has(permissionName);
    }) ?? true;
};

export const isProtectedUserRole = (role: UserManagementRole | undefined): boolean => (
    role?.permissions?.some(entry => {
        const permissionName = entry.permission?.name;
        return !!permissionName && gProtectedPermissions.has(permissionName as Permission);
    }) || false
);

export const isProtectedUser = (user: UserManagementPrincipal): boolean => (
    user.isSysAdmin || isProtectedUserRole(user.role)
);

// This is an additional target/ceiling policy. Existing endpoint, table, row,
// and field authorization remains mandatory and may be more restrictive.
export const canManageUser = ({ actor, target, action, desiredRole }: CanManageUserArgs): boolean => {
    if (!actor) {
        return false;
    }

    const actorIsSysadmin = actor.isSysAdmin === true;

    if (target.isDeleted === true) return false;

    if (action === "setSysAdmin") {
        return actorIsSysadmin;
    }

    // The current administrator-mediated reset URL is an account-takeover
    // credential and remains an actual-Sysadmin-only operation.
    //
    // TODO: consider making this a configurable permission. some work is to be done
    // to harden the process (shorter expiry, hide reset URL from screen by default,
    // find other channels to communicate reset URL, multi-factor authorize the reset)
    if (action === "resetPassword") {
        return actorIsSysadmin;
    }

    const targetIsProtected = isProtectedUser(target);

    // Impersonation
    // - reserved for an actual Sysadmin
    // - cannot target a protected principal, even as a defense-in-depth Sysadmin operation.
    // - cannot target oneself
    if (action === "impersonate") {
        return actorIsSysadmin && !targetIsProtected && actor.id !== target.id;
    }

    if (targetIsProtected && !actorIsSysadmin) return false;
    if (actorIsSysadmin) return true;

    if (action === "assignRole") {
        if (!roleHasPermission(actor.role, Permission.assign_user_roles)) return false;
        if (!isRoleWithinDelegationEnvelope(actor, target.role)) return false;
        if (desiredRole !== undefined && !isRoleWithinDelegationEnvelope(actor, desiredRole)) return false;
        return true;
    }

    if (action === "deactivate") {
        return roleHasPermission(actor.role, Permission.admin_users);
    }

    const isSelf = actor.id === target.id;
    if (isSelf && roleHasPermission(actor.role, Permission.basic_trust)) return true;
    return roleHasPermission(actor.role, Permission.manage_users);
};

export const getUserManagementCapabilities = (
    actor: UserManagementPrincipal | null,
    target: UserManagementPrincipal,
): UserManagementCapabilities => ({
    canAssignRole: canManageUser({ actor, target, action: "assignRole" }),
    canDeactivate: canManageUser({ actor, target, action: "deactivate" }),
    canEdit: canManageUser({ actor, target, action: "edit" }),
    canImpersonate: canManageUser({ actor, target, action: "impersonate" }),
    canResetPassword: canManageUser({ actor, target, action: "resetPassword" }),
    canSetSysAdmin: canManageUser({ actor, target, action: "setSysAdmin" }),
});

export const getContinuityWarningsForUserResult = (
    target: UserManagementPrincipal,
    resultingRole: UserManagementRole,
    activeNonSysadminUsers: readonly UserManagementPrincipal[],
): Permission[] => {
    if (target.isDeleted === true || target.isSysAdmin) return [];

    return gPermissionOrdered.filter(permission => {
        if (!gContinuitySensitivePermissions.has(permission)) return false;
        if (!roleHasPermission(target.role, permission)) return false;
        if (roleHasPermission(resultingRole, permission)) return false;

        return !activeNonSysadminUsers.some(user => (
            user.id !== target.id
            && user.isDeleted !== true
            && !user.isSysAdmin
            && roleHasPermission(user.role, permission)
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
