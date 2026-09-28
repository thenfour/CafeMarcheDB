import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import type { UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import { userPublicId } from "./userFixtures";

export function testServerAuthorization(
    user: Readonly<{ id: number; publicId?: string }> | null,
    effectivePermissions: ServerPermissionSet,
): CMServerAuthorization {
    // Focused DB3 policy fixtures inspect identity only, not the user payload.
    const principal = user
        ? { id: user.id, publicId: user.publicId ?? userPublicId(user.id) } as UserWithRolesPayload
        : null;
    return new CMServerAuthorization(principal, effectivePermissions);
}
