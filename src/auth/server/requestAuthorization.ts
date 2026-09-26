import { Permission } from "@/shared/permissions";
import type { SessionContext } from "@blitzjs/auth";
import { AuthenticationError, AuthorizationError } from "blitz";
import db from "db";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import type { DB3Authorization } from "src/core/db3/shared/db3Authorization";
import type { PublicDataType } from "types";
import type { ServerPermissionSet } from "./ServerPermissionSet";
import { loadEffectivePermissions } from "./effectivePermissions";

const loadFreshPrincipal = (
    database: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<UserWithRolesPayload | null> => userId
    ? database.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: userId, isDeleted: false },
    })
    : Promise.resolve(null);

// Blitz creates a SessionContext for each request
// use that as a cache key for request authorizations.

export class CMAuthorization implements DB3Authorization<ServerPermissionSet> {
    readonly userId: number | null;
    readonly userPublicId: string | null;

    constructor(
        readonly user: UserWithRolesPayload | null,
        readonly effectivePermissions: ServerPermissionSet,
    ) {
        this.userId = user?.id ?? null;
        this.userPublicId = user?.publicId ?? null;
    }

    hasPermission(permission: Permission): boolean {
        if (permission === Permission.never_grant) return false;
        if (permission === Permission.login && !this.user) return false;
        return this.effectivePermissions.includesName(permission);
    }

    requirePermission(permission: Permission): void {
        if (this.hasPermission(permission)) return;
        if (!this.user) throw new AuthenticationError(`Missing required permission: ${permission}`);
        throw new AuthorizationError(`Not authorized for ${permission}.`);
    }

    requireUser(): UserWithRolesPayload {
        if (!this.user) throw new AuthenticationError("An active user is required.");
        return this.user;
    }

    // A transaction must read its own authorization snapshot. Do not update the
    // request cache or session before that transaction commits.
    async refresh(database: TransactionalPrismaClient = db): Promise<CMAuthorization> {
        const user = await loadFreshPrincipal(database, this.userId);
        return new CMAuthorization(user, await loadEffectivePermissions(database, user));
    }
}

const requestAuthorizations = new WeakMap<SessionContext, {
    userId: number | null;
    handle: string | null; // session.$handle
    authorization: Promise<CMAuthorization>;
}>();

async function loadSessionAuthorization(session: SessionContext): Promise<CMAuthorization> {
    const user = await loadFreshPrincipal(db, session.userId);
    if (session.userId && !user) {
        // A missing or deactivated account loses its login. Ordinary changes to
        // grants or roles only replace authorization, preserving the session.
        await session.$revoke();
    }

    const effectivePermissions = await loadEffectivePermissions(db, user);
    const previous = session.$publicData;
    const current = {
        permissionNames: effectivePermissions.names,
        isSysAdmin: user?.isSysAdmin ?? false,
        showAdminControls: !!user?.isSysAdmin && !!previous.showAdminControls,
        GOOGLE_ANALYTICS_ID_BACKSTAGE: process.env.GOOGLE_ANALYTICS_ID_BACKSTAGE,
        GOOGLE_ANALYTICS_ID_PUBLIC: process.env.GOOGLE_ANALYTICS_ID_PUBLIC,
    } satisfies Partial<Omit<PublicDataType, "userId">>;

    if (!effectivePermissions.hasSameNames(previous.permissionNames ?? [])
        || previous.isSysAdmin !== current.isSysAdmin
        || previous.showAdminControls !== current.showAdminControls
        || previous.GOOGLE_ANALYTICS_ID_BACKSTAGE !== current.GOOGLE_ANALYTICS_ID_BACKSTAGE
        || previous.GOOGLE_ANALYTICS_ID_PUBLIC !== current.GOOGLE_ANALYTICS_ID_PUBLIC) {
        // Use Blitz's public-data API to synchronize the current request and
        // browser. Unchanged authorization causes no session write or cookies.
        await session.$setPublicData(current);
    }

    return new CMAuthorization(user, effectivePermissions);
}

export function loadAuthorization(session: SessionContext): Promise<CMAuthorization> {
    const previous = requestAuthorizations.get(session);
    if (previous && previous.userId === session.userId && previous.handle === session.$handle) {
        return previous.authorization; // existing.
    }

    const entry = {
        userId: session.userId,
        handle: session.$handle,
        authorization: loadSessionAuthorization(session),
    };
    requestAuthorizations.set(session, entry);
    return entry.authorization;
}

// Non-session entry points (for example calendar subscriptions) resolve the same effective grants as ordinary requests.
export async function loadAuthorizationForUser(
    user: UserWithRolesPayload | null,
    database: TransactionalPrismaClient = db,
): Promise<CMAuthorization> {
    return new CMAuthorization(user, await loadEffectivePermissions(database, user));
}
