import type { Prisma } from "@prisma/client";
import { getPermissionDefinition, gPermissionOrdered, Permission } from "shared/permissions";
import type { IAuthorization } from "./cmAuthorization";


// return a prisma where
// to select the assignable band roles based on the current user's permissions.
// used in a choices picker view
export function assignableBandRoleWhere(auth: IAuthorization): Prisma.BandRoleWhereInput {
    if (auth.hasPermission(Permission.sysadmin)) {
        return { isDeleted: false };
    }
    const allowed = gPermissionOrdered.filter(name => auth.hasPermission(name)
        && getPermissionDefinition(name).isDelegable);
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
