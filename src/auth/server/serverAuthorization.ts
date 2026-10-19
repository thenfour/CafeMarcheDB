import type { SessionContext } from "@blitzjs/auth";
import { AuthenticationError, AuthorizationError } from "blitz";
import { getPermissionDefinition, isPermission, Permission } from "shared/permissions";
import { parsePublicId, type BandPublicId, type UserPublicId } from "shared/publicId";
import { HydratedUserWithRolesPayload, NullableHydrateUserWithRoles, UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import type { PublicDataType } from "types";
import type { IAuthorization, ScopedAuthorizationData } from "../shared/cmAuthorization";
import { describePermissionRequirement, satisfiesPermissionRequirement, type PermissionRequirement } from "../shared/permissionRequirement";
import { PermissionSet } from "../shared/PermissionSet";
import {
    authorizationDatabase, resolveAuthorizationContext,
    type AuthorizationBand, type AuthorizationDatabase,
    type AuthorizationMembership, type ResolvedAuthorizationContext,
} from "./authorizationContext";
import { loadEffectivePermissionContext, type EffectivePermissionContext } from "./effectivePermissions";
import { assertAuthorizationBandScope } from "./requestAuthorizationScope";
import { ServerPermissionSet } from "./ServerPermissionSet";

const loadFreshPrincipal = async (
    database: AuthorizationDatabase,
    userId: number | null | undefined,
): Promise<HydratedUserWithRolesPayload | null> => {
    if (!userId) return Promise.resolve(null);
    return NullableHydrateUserWithRoles(await database.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: userId, isDeleted: false, mergedIntoUserId: null },
    }));
};

type AuthorizationDetails = ResolvedAuthorizationContext & EffectivePermissionContext;

export class CMServerAuthorization implements IAuthorization {
    readonly user: HydratedUserWithRolesPayload | null;
    readonly userId: number | null;
    readonly userPublicId: UserPublicId | null;
    readonly sessionHandle: string | null;
    readonly effectivePermissions: ServerPermissionSet;
    readonly globalPermissions: ServerPermissionSet;
    readonly bandPermissions: ServerPermissionSet;
    readonly sessionPermissions: ServerPermissionSet;
    readonly band: AuthorizationBand | null;
    readonly membership: AuthorizationMembership | null;

    constructor(
        user: HydratedUserWithRolesPayload | null,
        effectivePermissions: ServerPermissionSet,
        sessionHandle: string | null = null,
        private readonly details?: AuthorizationDetails,
    ) {
        if (!(effectivePermissions instanceof ServerPermissionSet)) {
            throw new Error("Server effective permissions are required.");
        }
        this.user = user;
        this.userId = user?.id ?? null;
        this.userPublicId = user?.publicId ? parsePublicId<"User">(user.publicId) : null;
        this.effectivePermissions = effectivePermissions;
        this.sessionHandle = sessionHandle;
        this.globalPermissions = details?.globalPermissions ?? new ServerPermissionSet([]);
        this.bandPermissions = details?.bandPermissions ?? new ServerPermissionSet([]);
        this.sessionPermissions = details?.sessionPermissions ?? new ServerPermissionSet([]);
        this.band = details?.band ?? null;
        this.membership = details?.membership ?? null;
        if (this.membership && (this.membership.userId !== this.userId
            || this.membership.bandId !== this.band?.id || this.membership.isDeleted)) {
            throw new Error("Membership does not match the active person and band.");
        }
    }

    hasPermission(permission: PermissionRequirement): boolean {
        return satisfiesPermissionRequirement(permission, candidate => candidate !== Permission.never_grant
            && this.effectivePermissions.includesName(candidate), this.band !== null);
    }

    requirePermission(permission: PermissionRequirement): void {
        if (!this.hasPermission(permission)) {
            if (!this.user) {
                throw new AuthenticationError(`Not authorized for ${describePermissionRequirement(permission)}.`);
            }
            throw new AuthorizationError(`Not authorized for ${describePermissionRequirement(permission)}.`);
        }
    }

    requireBand(): AuthorizationBand {
        if (!this.band) throw new AuthorizationError("A band context is required.");
        return this.band;
    }

    requireBandResource(bandId: number): void {
        if (this.requireBand().id !== bandId) throw new AuthorizationError("The resource belongs to another band.");
    }

    requireMembership(): AuthorizationMembership {
        this.requireUser();
        if (!this.membership) throw new AuthorizationError("An active membership is required.");
        return this.membership;
    }

    toClientContext(): ScopedAuthorizationData {
        return {
            userPublicId: this.userPublicId,
            bandPublicId: this.band ? parsePublicId<"Band">(this.band.publicId) : null,
            bandUserPublicId: this.membership ? parsePublicId<"BandUser">(this.membership.publicId) : null,
            effectivePermissionNames: this.effectivePermissions.names,
        };
    }

    requireUser(): CMServerAuthorizationWithUser {
        if (!this.user) throw new AuthenticationError("An active user is required.");
        return new CMServerAuthorizationWithUser(this.user, this.effectivePermissions, this.sessionHandle, this.details);
    }

    hasAllDelegable(other: Readonly<PermissionSet>): boolean {
        return other.names.every(name => isPermission(name)
            && getPermissionDefinition(name).isDelegable && this.hasPermission(name));
    }

    async refresh(database: AuthorizationDatabase = authorizationDatabase): Promise<CMServerAuthorization> {
        return loadSnapshot(database, this.userId, this.sessionHandle, this.band ? parsePublicId<"Band">(this.band.publicId) : null);
    }
}

export class CMServerAuthorizationWithUser extends CMServerAuthorization {
    declare readonly user: HydratedUserWithRolesPayload;
    declare readonly userId: number;
    declare readonly userPublicId: UserPublicId;

    constructor(
        user: HydratedUserWithRolesPayload,
        effectivePermissions: ServerPermissionSet,
        sessionHandle: string | null = null,
        details?: AuthorizationDetails,
    ) {
        super(user, effectivePermissions, sessionHandle, details);
    }
}

async function loadSnapshot(
    database: AuthorizationDatabase,
    userId: number | null | undefined,
    sessionHandle: string | null,
    bandPublicId?: BandPublicId | null,
): Promise<CMServerAuthorization> {
    const user = await loadFreshPrincipal(database, userId);
    const context = await resolveAuthorizationContext(database, bandPublicId);
    const permissions = await loadEffectivePermissionContext(database, user, context.band?.id ?? null);
    return new CMServerAuthorization(user, permissions.effectivePermissions, sessionHandle, {
        ...context, ...permissions,
    });
}

type SessionAuthorizationEntry = {
    readonly userId: number | null | undefined;
    readonly handle: string | null;
    readonly authorization: Promise<CMServerAuthorization>;
};
const serverAuthorizations = new WeakMap<SessionContext, Map<BandPublicId | null, SessionAuthorizationEntry>>();

async function synchronizeSharedSession(session: SessionContext, auth: CMServerAuthorization): Promise<void> {
    if (session.userId && !auth.user) await session.$revoke();
    const previous = session.$publicData;
    const current = {
        permissionNames: auth.sessionPermissions.names,
        isSysAdmin: auth.hasPermission(Permission.sysadmin),
        showAdminControls: auth.sessionPermissions.includesName(Permission.sysadmin) && !!previous.showAdminControls,
        GOOGLE_ANALYTICS_ID_BACKSTAGE: process.env.GOOGLE_ANALYTICS_ID_BACKSTAGE,
        GOOGLE_ANALYTICS_ID_PUBLIC: process.env.GOOGLE_ANALYTICS_ID_PUBLIC,
    } satisfies Partial<Omit<PublicDataType, "userId">>;

    if (!auth.sessionPermissions.hasSameNames(previous.permissionNames ?? [])
        || previous.isSysAdmin !== current.isSysAdmin
        || previous.showAdminControls !== current.showAdminControls
        || previous.GOOGLE_ANALYTICS_ID_BACKSTAGE !== current.GOOGLE_ANALYTICS_ID_BACKSTAGE
        || previous.GOOGLE_ANALYTICS_ID_PUBLIC !== current.GOOGLE_ANALYTICS_ID_PUBLIC) {
        await session.$setPublicData(current);
    }
}

export async function loadAuthorization(
    session: SessionContext,
    bandPublicId?: BandPublicId | null,
): Promise<CMServerAuthorization> {
    assertAuthorizationBandScope(bandPublicId);
    const key = bandPublicId == null ? null : parsePublicId<"Band">(bandPublicId);
    const entries = serverAuthorizations.get(session) ?? new Map<BandPublicId | null, SessionAuthorizationEntry>();
    serverAuthorizations.set(session, entries);
    let entry = entries.get(key);
    if (!entry || entry.userId !== session.userId || entry.handle !== session.$handle) {
        entry = {
            userId: session.userId,
            handle: session.$handle,
            authorization: loadSessionSnapshot(session, key),
        };
        entries.set(key, entry);
    }
    return entry.authorization;
}

async function loadSessionSnapshot(session: SessionContext, bandPublicId: BandPublicId | null): Promise<CMServerAuthorization> {
    const auth = await loadSnapshot(authorizationDatabase, session.userId, session.$handle, bandPublicId);
    await synchronizeSharedSession(session, auth);
    return auth;
}

// Feed and other non-session callers supply person identity; refresh roles and
// account state from the database rather than trusting a previously loaded DTO.
export async function loadAuthorizationForUser(
    user: Pick<UserWithRolesPayload, "id"> | null,
    database: AuthorizationDatabase = authorizationDatabase,
    bandPublicId?: BandPublicId | null,
): Promise<CMServerAuthorization> {
    assertAuthorizationBandScope(bandPublicId);
    return loadSnapshot(database, user?.id ?? null, null, bandPublicId);
}
