import { AuthenticationError } from "blitz";
import { Permission } from "@/shared/permissions";
import { parsePublicId, type BandPublicId, type BandUserPublicId, type UserPublicId } from "@/shared/publicId";
import type { UserWithRolesPayload } from "@/src/core/db3/shared/schema/userPayloads";
import { PermissionSet } from "./PermissionSet";
import { describePermissionRequirement, satisfiesPermissionRequirement, type PermissionRequirement } from "./permissionRequirement";

/** Public identities and display grants for one tab's resolved context. */
export interface ScopedAuthorizationData {
    readonly userPublicId: UserPublicId | null;
    readonly bandPublicId: BandPublicId | null;
    readonly bandUserPublicId: BandUserPublicId | null;
    readonly effectivePermissionNames: Permission[];
}

// The shared surface supports client hints and server checks. Database reads
// require CMServerAuthorization so they can use trusted permission IDs.
export interface IAuthorization {
    readonly userId: number | null;
    readonly userPublicId: UserPublicId | null;
    readonly sessionHandle: string | null;

    hasPermission(permission: PermissionRequirement): boolean;

    requirePermission(permission: PermissionRequirement): void;

}

type ClientAuthorizationUser = Pick<UserWithRolesPayload, "id" | "publicId">;

export class CMClientAuthorization implements IAuthorization {
    readonly userId: number | null;
    readonly userPublicId: UserPublicId | null;

    constructor(
        readonly user: ClientAuthorizationUser | null,
        readonly effectivePermissions: PermissionSet,
        readonly sessionHandle: string | null = null,
        readonly bandPublicId?: BandPublicId | null,
    ) {
        if (!(effectivePermissions instanceof PermissionSet)) {
            throw new Error("DB3 effective permissions are required.");
        }
        this.userId = user?.id ?? null;
        this.userPublicId = user?.publicId ? parsePublicId<"User">(user.publicId) : null;
    }

    hasPermission(permission: PermissionRequirement): boolean {
        return satisfiesPermissionRequirement(permission, candidate => candidate !== Permission.never_grant
            && this.effectivePermissions.includesName(candidate), this.bandPublicId != null);
    }

    requirePermission(permission: PermissionRequirement): void {
        if (!this.hasPermission(permission)) {
            throw new AuthenticationError(`Missing required permission: ${describePermissionRequirement(permission)}`);
        }
    }

}
