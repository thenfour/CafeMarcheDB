import type { Prisma } from "@prisma/client";
import { getPermissionDefinition, gPermissionRegistry, isPermission } from "shared/permissions";
import { kGlobalVisibilityPermissionPolicy } from "src/auth/shared/bandPermissionPolicy";
import type { IAuthorization } from "src/auth/shared/cmAuthorization";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";

const kBandVisibilityPermissionNames = gPermissionRegistry
    .filter(definition => definition.scope === "band" && definition.isVisibility)
    .map(definition => definition.key);

/** shared by choices and foreign refs */
export function selectableBandVisibilityPermissionWhere(
    auth: Pick<CMServerAuthorization, "hasPermission" | "effectivePermissions">,
): Prisma.PermissionWhereInput {
    return {
        isDeleted: false,
        isVisibility: true,
        name: { in: kBandVisibilityPermissionNames },
        ...(auth.hasPermission(kGlobalVisibilityPermissionPolicy)
            ? {} : { id: { in: auth.effectivePermissions.ids } }),
    };
}

// companion function to selectableBandVisibilityPermissionWhere
export function isSelectableBandVisibilityPermission(
    permission: Readonly<{ name: string; isVisibility: boolean; isDeleted?: boolean }>,
    auth: Pick<IAuthorization, "hasPermission">,
): boolean {
    if (permission.isDeleted || !permission.isVisibility || !isPermission(permission.name)) {
        return false;
    }
    const definition = getPermissionDefinition(permission.name);
    return definition.scope === "band" && definition.isVisibility
        && (auth.hasPermission(permission.name) || auth.hasPermission(kGlobalVisibilityPermissionPolicy));
}
