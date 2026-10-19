import type { GlobalScopedPermission, Permission } from "shared/permissions";
import type { ScopedAuthorizationData } from "./cmAuthorization";

// Alternatives belong to the operation's policy, never to the role's grants.
export type PermissionRequirement = Permission | Readonly<{
    anyOf: readonly Permission[];
    requiresBand: boolean;
}>;

export type GlobalPermissionRequirement = Permission | Readonly<{
    anyOf: readonly GlobalScopedPermission[];
    requiresBand: boolean;
}>;


export function satisfiesPermissionRequirement(
    requirement: PermissionRequirement,
    isGranted: (permission: Permission) => boolean,
    hasBandContext: boolean,
): boolean {
    if (typeof requirement === "string") {
        return isGranted(requirement);
    }
    return (!requirement.requiresBand || hasBandContext) && requirement.anyOf.some(isGranted);
}

// actually only currently used for error-handling messaging.
export function describePermissionRequirement(requirement: PermissionRequirement): string {
    return JSON.stringify(requirement);
}

export function permissionNamesSatisfyRequirement(
    names: readonly Permission[] | undefined,
    requirement: PermissionRequirement,
    hasBandContext: boolean,
): boolean {
    return satisfiesPermissionRequirement(requirement, permission => names?.includes(permission) ?? false, hasBandContext);
}

// standalone function because auth can sometimes be null so simpler than auth.satisfies...(requirement)
export function scopedAuthorizationSatisfiesRequirement(
    auth: Pick<ScopedAuthorizationData, "effectivePermissionNames" | "bandPublicId"> | null | undefined,
    requirement: PermissionRequirement,
): boolean {
    return permissionNamesSatisfyRequirement(auth?.effectivePermissionNames, requirement,
        Boolean(auth?.bandPublicId));
}
