import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import type { UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import { userPublicId } from "./userFixtures";
import { parsePublicId } from "shared/publicId";

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

/** A selected-band policy fixture; native tests load these details from real membership/grant rows. */
export function testBandAuthorization(
    user: Readonly<{ id: number; publicId?: string }> | null,
    effectivePermissions: ServerPermissionSet,
): CMServerAuthorization {
    const principal = testServerAuthorization(user, effectivePermissions).user;
    return new CMServerAuthorization(principal, effectivePermissions, null, {
        band: { id: 1, publicId: parsePublicId<"Band">("FixtureBand00001") },
        membership: user ? { id: 1, publicId: "FixtureMember001", userId: user.id, bandId: 1,
            bandRoleId: 1, isDeleted: false } : null,
        effectivePermissions, bandPermissions: effectivePermissions,
        globalPermissions: new ServerPermissionSet([]), sessionPermissions: new ServerPermissionSet([]),
    });
}
