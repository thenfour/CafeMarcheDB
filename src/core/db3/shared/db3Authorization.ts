import { assert } from "blitz";
import { PermissionSet } from "src/auth/shared/PermissionSet";

export interface DB3Authorization {
    readonly userId: number | null;
    readonly effectivePermissions: PermissionSet;
}

export function createDB3Authorization(
    user: Readonly<{ id: number }> | null,
    effectivePermissions: PermissionSet,
): DB3Authorization {
    assert(effectivePermissions instanceof PermissionSet, "DB3 effective permissions are required.");
    return { userId: user?.id ?? null, effectivePermissions };
}
