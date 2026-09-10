import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";

export type UserManagementAction =
    | "assignRole"
    | "deactivate"
    | "edit"
    | "impersonate"
    | "resetPassword";

type PermissionEntry = {
    permission?: {
        name?: string | null;
    } | null;
};

export type UserManagementRole = {
    permissions?: readonly PermissionEntry[];
} | null;

export type UserManagementPrincipal = {
    id: number;
    isSysAdmin: boolean;
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
}

export const gProtectedUserPermissions = new Set<Permission>([
    Permission.sysadmin,
    Permission.impersonate_user,
    Permission.never_grant,
]);

const roleHasPermission = (role: UserManagementRole | undefined, permission: Permission): boolean => (
    role?.permissions?.some(entry => entry.permission?.name === permission) || false
);

export const isProtectedUserRole = (role: UserManagementRole | undefined): boolean => (
    role?.permissions?.some(entry => {
        const permissionName = entry.permission?.name;
        return !!permissionName && gProtectedUserPermissions.has(permissionName as Permission);
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
        if (desiredRole !== undefined && isProtectedUserRole(desiredRole)) return false;
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
});

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
