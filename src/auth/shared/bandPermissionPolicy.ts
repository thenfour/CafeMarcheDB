import { type BandScopedPermission, gPermissionRegistry, Permission } from "shared/permissions";
import type { GlobalPermissionRequirement } from "./permissionRequirement";

type BandAuthority<TName extends BandScopedPermission> = Readonly<{
    anyOf: readonly [TName, typeof Permission.global_band_admin];
    requiresBand: true;
}>;

// helper which adds global perms to the band-scoped permission
const bandAuthority = <const TName extends BandScopedPermission>(permission: TName): BandAuthority<TName> => ({
    anyOf: [permission, Permission.global_band_admin],
    requiresBand: true,
});

// here we can define policies for band-level features via global permissions
// globalVisibilityPermission
export const kGlobalVisibilityPermissionPolicy = {
    anyOf: [Permission.global_band_admin],
    requiresBand: true,
} as const satisfies GlobalPermissionRequirement;


type BandPermissionMap = {
    readonly [K in BandScopedPermission]: BandAuthority<K>;
};

// generate a map of band-scoped permissions to band authority policy
// fromEntries loses key/value correlation; each pair uses the same definition key.
export const BandPermission = Object.freeze(Object.fromEntries(
    gPermissionRegistry.flatMap(definition =>
        definition.scope === "band"
            ? [[definition.key, bandAuthority(definition.key)]]
            : []
    )
)) as BandPermissionMap;
