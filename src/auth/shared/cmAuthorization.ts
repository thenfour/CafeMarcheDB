import { AuthenticationError } from "blitz";
import { Permission } from "@/shared/permissions";
import { parsePublicId, type BandPublicId, type BandUserPublicId, type UserPublicId } from "@/shared/publicId";
import type { UserWithRolesPayload } from "@/src/core/db3/shared/schema/userPayloads";
import { PermissionSet } from "./PermissionSet";

/** Public identities and display grants for one tab's resolved context. */
export interface ScopedAuthorizationData {
    readonly userPublicId: UserPublicId | null;
    readonly bandPublicId: BandPublicId | null;
    readonly bandUserPublicId: BandUserPublicId | null;
    readonly effectivePermissionNames: string[];
}

// The shared surface supports client hints and server checks. Database reads
// require CMServerAuthorization so they can use trusted permission IDs.
export interface IAuthorization {
    readonly userId: number | null;
    readonly userPublicId: UserPublicId | null;
    readonly sessionHandle: string | null;

    hasPermission(permission: Permission): boolean;

    requirePermission(permission: Permission): void;

}

type ClientAuthorizationUser = Pick<UserWithRolesPayload, "id" | "publicId">;

export class CMClientAuthorization implements IAuthorization {
    readonly userId: number | null;
    readonly userPublicId: UserPublicId | null;

    constructor(
        readonly user: ClientAuthorizationUser | null,
        readonly effectivePermissions: PermissionSet,
        readonly sessionHandle: string | null = null,
    ) {
        if (!(effectivePermissions instanceof PermissionSet)) {
            throw new Error("DB3 effective permissions are required.");
        }
        this.userId = user?.id ?? null;
        this.userPublicId = user?.publicId ? parsePublicId<"User">(user.publicId) : null;
    }

    hasPermission(permission: Permission): boolean {
        return permission !== Permission.never_grant && this.effectivePermissions.includesName(permission);
    }

    requirePermission(permission: Permission): void {
        if (!this.hasPermission(permission)) {
            throw new AuthenticationError(`Missing required permission: ${permission}`);
        }
    }

}
