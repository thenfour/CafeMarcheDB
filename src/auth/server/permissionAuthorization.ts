import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import { loadEffectivePermissionNames } from "./effectivePermissions";

class FreshPermissionAuthorizationError extends AuthorizationError {
    constructor(permission: Permission) {
        super();
        this.message = `Not authorized for ${permission}.`;
        this.name = "FreshPermissionAuthorizationError";
    }
}

export const principalHasPermission = (
    permissionNames: readonly string[],
    permission: Permission,
): boolean => {
    if (permission === Permission.never_grant) return false;
    return permissionNames.includes(permission);
};

export const loadFreshPrincipal = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<UserWithRolesPayload | null> => userId
    ? db.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: userId, isDeleted: false },
    })
    : null;

export const requireFreshAuthorization = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
    permission: Permission,
): Promise<UserWithRolesPayload | null> => {
    const actor = await loadFreshPrincipal(db, userId);
    const permissionNames = await loadEffectivePermissionNames(db, actor);
    if (!principalHasPermission(permissionNames, permission)) {
        throw new FreshPermissionAuthorizationError(permission);
    }
    return actor;
};

// Session permissions are a useful fast first gate, but mutations which grant
// delegated administration must also re-read the active actor. This closes the
// interval between a role change and session refresh/invalidation.
export const requireFreshPermission = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
    permission: Permission,
): Promise<UserWithRolesPayload & { effectivePermissionNames: string[] }> => {
    const actor = await requireFreshAuthorization(db, userId, permission);
    if (!actor) {
        throw new FreshPermissionAuthorizationError(permission);
    }
    return {
        ...actor,
        effectivePermissionNames: await loadEffectivePermissionNames(db, actor),
    };
};
