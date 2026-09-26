import { assert } from "blitz";
import { PermissionSet } from "src/auth/shared/PermissionSet";

export interface DB3Authorization<TPermissions extends PermissionSet = PermissionSet> {
    readonly userId: number | null;
    readonly userPublicId?: string | null;
    readonly effectivePermissions: TPermissions;
}
export function createDB3Authorization<TPermissions extends PermissionSet>(
    user: Readonly<{ id: number; publicId?: string }> | null,
    effectivePermissions: TPermissions,
): DB3Authorization<TPermissions> {
    assert(effectivePermissions instanceof PermissionSet, "DB3 effective permissions are required.");
    return { userId: user?.id ?? null, userPublicId: user?.publicId ?? null, effectivePermissions };
}
