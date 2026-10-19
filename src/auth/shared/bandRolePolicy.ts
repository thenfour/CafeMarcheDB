import type { Prisma } from "@prisma/client";
import { getPermissionDefinition, gPermissionOrdered, Permission } from "shared/permissions";
import type { IAuthorization } from "./cmAuthorization";

function delegableBandPermissionNames(auth: IAuthorization): Permission[] {
    const administersBands = auth.hasPermission({ anyOf: [Permission.global_band_admin], requiresBand: true });
    return gPermissionOrdered.filter(name => {
        const definition = getPermissionDefinition(name);
        return definition.scope === "band" && definition.isDelegable
            && (administersBands || auth.hasPermission(name));
    });
}

/** Cross-band delegation is an explicit band operation, without changing account grants. */
export function canDelegateBandRoleGrants(auth: IAuthorization, permissionNames: readonly string[]): boolean {
    if (auth.hasPermission(Permission.sysadmin)) {
        return true;
    }
    const allowed = new Set<string>(delegableBandPermissionNames(auth));
    return permissionNames.every(name => allowed.has(name));
}

// return a prisma where
// to select the assignable band roles based on the current user's permissions.
// used in a choices picker view
export function assignableBandRoleWhere(auth: IAuthorization): Prisma.BandRoleWhereInput {
    if (auth.hasPermission(Permission.sysadmin)) {
        return { isDeleted: false };
    }
    const allowed = delegableBandPermissionNames(auth);
    return {
        isDeleted: false,
        bandRolePermissions: {
            none: {
                permission: {
                    isDeleted: false,
                    name: { notIn: allowed }
                }
            },
        },
    };
}
