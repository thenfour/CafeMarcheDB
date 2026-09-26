import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { Ctx } from "@blitzjs/next";
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
