import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { Ctx } from "@blitzjs/next";
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

// convenience helper that wraps
// const requestAuthorization = await getRequestAuthorization(ctx.session);
// const authorization = createDB3Authorization(
//     requestAuthorization.user,
//     requestAuthorization.effectivePermissions,
// );
export async function createDb3RequestAuthorization(ctx: Ctx) {
    const requestAuthorization = await getRequestAuthorization(ctx.session);
    const ret = createDB3Authorization(
        requestAuthorization.user,
        requestAuthorization.effectivePermissions,
    );
    return {
        ...ret,
        ...requestAuthorization,
    }
}
