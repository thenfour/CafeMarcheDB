import { getPermissionDefinition, isPermission, Permission } from "shared/permissions";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import type { SessionContext } from "@blitzjs/auth";
import { AuthenticationError, AuthorizationError } from "blitz";
import { UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import type { PublicDataType } from "types";
import type { IAuthorization, ScopedAuthorizationData } from "../shared/cmAuthorization";
import { PermissionSet } from "../shared/PermissionSet";
import { loadEffectivePermissionContext, type EffectivePermissionContext } from "./effectivePermissions";
import { ServerPermissionSet } from "./ServerPermissionSet";
import {
    authorizationDatabase, authorizationScopeKey, configuredBandScope, resolveAuthorizationContext,
    type AuthorizationBand, type AuthorizationDatabase,
    type AuthorizationMembership, type AuthorizationScopeSelection, type ResolvedAuthorizationContext,
} from "./authorizationContext";

const loadFreshPrincipal = (
    database: AuthorizationDatabase,
    userId: number | null | undefined,
): Promise<UserWithRolesPayload | null> => userId
        ? database.user.findFirst({
            ...UserWithRolesArgs,
            where: { id: userId, isDeleted: false, mergedIntoUserId: null },
        })
        : Promise.resolve(null);

interface AuthorizationDetails extends ResolvedAuthorizationContext, EffectivePermissionContext {
    readonly selection: AuthorizationScopeSelection;
}

export class CMServerAuthorization implements IAuthorization {
    readonly user: UserWithRolesPayload | null;
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
        user: UserWithRolesPayload | null,
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

    hasPermission(permission: Permission): boolean {
        return permission !== Permission.never_grant && this.effectivePermissions.includesName(permission);
    }

    requirePermission(permission: Permission): void {
        if (!this.hasPermission(permission)) {
            if (!this.user) throw new AuthenticationError(`Not authorized for ${permission}.`);
            throw new AuthorizationError(`Not authorized for ${permission}.`);
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
        return loadSnapshot(database, this.userId, this.sessionHandle, this.details?.selection ?? configuredBandScope);
    }
}

export class CMServerAuthorizationWithUser extends CMServerAuthorization {
    declare readonly user: UserWithRolesPayload;
    declare readonly userId: number;
    declare readonly userPublicId: UserPublicId;

    constructor(
        user: UserWithRolesPayload,
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
    selection: AuthorizationScopeSelection,
): Promise<CMServerAuthorization> {
    const user = await loadFreshPrincipal(database, userId);
    const context = await resolveAuthorizationContext(database, selection);
    const permissions = await loadEffectivePermissionContext(database, user, context.band?.id ?? null);
    return new CMServerAuthorization(user, permissions.effectivePermissions, sessionHandle, {
        ...context, ...permissions, selection,
    });
}

type SessionAuthorizationEntry = {
    readonly userId: number | null | undefined;
    readonly handle: string | null;
    readonly authorization: Promise<CMServerAuthorization>;
};
const serverAuthorizations = new WeakMap<SessionContext, Map<string, SessionAuthorizationEntry>>();

async function synchronizeSharedSession(session: SessionContext, auth: CMServerAuthorization): Promise<void> {
    if (session.userId && !auth.user) await session.$revoke();
    const previous = session.$publicData;
    const current = {
        permissionNames: auth.sessionPermissions.names,
        isSysAdmin: auth.user?.isSysAdmin ?? false,
        showAdminControls: !!auth.user?.isSysAdmin && !!previous.showAdminControls,
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
    selection: AuthorizationScopeSelection = configuredBandScope,
): Promise<CMServerAuthorization> {
    const key = authorizationScopeKey(selection);
    const entries = serverAuthorizations.get(session) ?? new Map<string, SessionAuthorizationEntry>();
    serverAuthorizations.set(session, entries);
    let entry = entries.get(key);
    if (!entry || entry.userId !== session.userId || entry.handle !== session.$handle) {
        entry = {
            userId: session.userId,
            handle: session.$handle,
            authorization: loadSessionSnapshot(session, selection),
        };
        entries.set(key, entry);
    }
    return entry.authorization;
}

async function loadSessionSnapshot(session: SessionContext, selection: AuthorizationScopeSelection): Promise<CMServerAuthorization> {
    const auth = await loadSnapshot(authorizationDatabase, session.userId, session.$handle, selection);
    await synchronizeSharedSession(session, auth);
    return auth;
}

// Feed and other non-session callers supply person identity; refresh roles and
// account state from the database rather than trusting a previously loaded DTO.
export async function loadAuthorizationForUser(
    user: Pick<UserWithRolesPayload, "id"> | null,
    database: AuthorizationDatabase = authorizationDatabase,
    selection: AuthorizationScopeSelection = configuredBandScope,
): Promise<CMServerAuthorization> {
    return loadSnapshot(database, user?.id ?? null, null, selection);
}
