import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";

class FreshPermissionAuthorizationError extends AuthorizationError {
    constructor(permission: Permission) {
        super();
        this.message = `Not authorized for ${permission}.`;
        this.name = "FreshPermissionAuthorizationError";
    }
}

export const principalHasPermission = (
    actor: UserWithRolesPayload | null,
    permission: Permission,
): boolean => !!actor && (
    actor.isSysAdmin
    || actor.role?.permissions.some(entry => entry.permission.name === permission)
    || false
);

// Session permissions are a useful fast first gate, but mutations which grant
// delegated administration must also re-read the active actor. This closes the
// interval between a role change and session refresh/invalidation.
export const requireFreshPermission = async (
    db: TransactionalPrismaClient,
    userId: number | null | undefined,
    permission: Permission,
): Promise<UserWithRolesPayload> => {
    const actor = userId
        ? await db.user.findFirst({
            ...UserWithRolesArgs,
            where: { id: userId, isDeleted: false },
        })
        : null;
    if (!principalHasPermission(actor, permission)) {
        throw new FreshPermissionAuthorizationError(permission);
    }
    return actor!;
};
