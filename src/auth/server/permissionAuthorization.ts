import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import { loadEffectivePermissions } from "./effectivePermissions";
import { PermissionSet } from "../shared/PermissionSet";
import type { ServerPermissionSet } from "./ServerPermissionSet";

class FreshPermissionAuthorizationError extends AuthorizationError {
    constructor(permission: Permission) {
        super();
        this.message = `Not authorized for ${permission}.`;
        this.name = "FreshPermissionAuthorizationError";
    }
}

export const principalHasPermission = (
    permissionSet: Readonly<PermissionSet>,
    permission: Permission,
): boolean => {
    if (permission === Permission.never_grant) return false;
    return permissionSet.includesName(permission);
};

// consider using
//     const auth = await getRequestAuthorization(session);
//    requirePermission(auth, route.permission);
export function assertPermission(permissionSet: Readonly<PermissionSet>, permission: Permission): void {
    if (!principalHasPermission(permissionSet, permission)) {
        throw new FreshPermissionAuthorizationError(permission);
    }
}

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
    const permissions = await loadEffectivePermissions(db, actor);
    assertPermission(permissions, permission);
    return actor;
};

// Session permissions are a useful fast first gate, but mutations which grant
// delegated administration must also re-read the active actor. This closes the
// interval between a role change and session refresh/invalidation.
export const requireFreshPermission = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
    permission: Permission,
): Promise<UserWithRolesPayload & { effectivePermissions: ServerPermissionSet }> => {
    const actor = await requireFreshAuthorization(db, userId, permission);
    if (!actor) {
        throw new FreshPermissionAuthorizationError(permission);
    }
    return {
        ...actor,
        effectivePermissions: await loadEffectivePermissions(db, actor),
    };
};
