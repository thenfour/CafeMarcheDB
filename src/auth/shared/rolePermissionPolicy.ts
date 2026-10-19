import { AuthorizationError } from "blitz";
import { getPermissionDefinition, isPermission, Permission } from "shared/permissions";
import type { AssociationWriteContext } from "src/core/db3/shared/columnTypes/tags";

export type RoleScope = "global" | "band";

/** Both the role editor and matrix write the role's association field. */
export async function validateRolePermissionWrite(scope: RoleScope, context: AssociationWriteContext): Promise<void> {
    context.authorization.requirePermission(Permission.sysadmin);
    const permissions = await context.database.permission.findMany({
        where: { id: { in: [...context.desiredForeignIds] }, isDeleted: false },
        select: { id: true, name: true },
    });
    if (permissions.length !== new Set(context.desiredForeignIds).size) {
        throw new AuthorizationError("Role grants require active permissions.");
    }
    for (const permission of permissions) {
        if (permission.name === Permission.never_grant) {
            throw new AuthorizationError("never_grant cannot be assigned to roles.");
        }
        if (!isPermission(permission.name) || getPermissionDefinition(permission.name).scope !== scope) {
            throw new AuthorizationError(`A ${scope} role can grant only known ${scope} permissions.`);
        }
    }
    if (scope === "global") {
        const role = await context.database.globalRole.findUniqueOrThrow({ where: { id: context.localId } });
        if (role.isSysAdminRole && ![Permission.sysadmin, Permission.login].every(name => permissions.some(permission => permission.name === name))) {
            throw new AuthorizationError("The designated Sysadmin role must retain sysadmin and login.");
        }
    }
}
