import type { SessionContext } from "@blitzjs/auth";
import db from "db";
import type { PublicDataType } from "types";
import { loadEffectivePermissions, type EffectivePermissions } from "./effectivePermissions";
import { loadFreshPrincipal } from "./permissionAuthorization";
import type { UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";

// Blitz creates a SessionContext for each request
// use that as a cache key for request authorizations.

export interface RequestAuthorization {
    user: UserWithRolesPayload | null;
    effectivePermissions: EffectivePermissions;
}

const requestAuthorizations = new WeakMap<SessionContext, {
    userId: number | null;
    handle: string | null; // session.$handle
    authorization: Promise<RequestAuthorization>;
}>();

const areEqualPermissionSets = (previous: readonly string[], current: readonly string[]): boolean => {
    const previousSet = new Set(previous);
    return previous.length === current.length && current.every(permission => previousSet.has(permission));
};

async function refreshAuthorization(session: SessionContext): Promise<RequestAuthorization> {
    const user = await loadFreshPrincipal(db, session.userId);
    if (session.userId && !user) {
        // A missing or deactivated account loses its login. Ordinary changes to
        // grants or roles only replace authorization, preserving the session.
        await session.$revoke();
    }

    const effectivePermissions = await loadEffectivePermissions(db, user);
    const previous = session.$publicData;
    const current = {
        permissions: effectivePermissions.names,
        isSysAdmin: user?.isSysAdmin ?? false,
        showAdminControls: !!user?.isSysAdmin && !!previous.showAdminControls,
        GOOGLE_ANALYTICS_ID_BACKSTAGE: process.env.GOOGLE_ANALYTICS_ID_BACKSTAGE,
        GOOGLE_ANALYTICS_ID_PUBLIC: process.env.GOOGLE_ANALYTICS_ID_PUBLIC,
    } satisfies Partial<Omit<PublicDataType, "userId">>;

    if (!areEqualPermissionSets(previous.permissions ?? [], current.permissions)
        || previous.isSysAdmin !== current.isSysAdmin
        || previous.showAdminControls !== current.showAdminControls
        || previous.GOOGLE_ANALYTICS_ID_BACKSTAGE !== current.GOOGLE_ANALYTICS_ID_BACKSTAGE
        || previous.GOOGLE_ANALYTICS_ID_PUBLIC !== current.GOOGLE_ANALYTICS_ID_PUBLIC) {
        // Use Blitz's public-data API to synchronize the current request and
        // browser. Unchanged authorization causes no session write or cookies.
        await session.$setPublicData(current);
    }

    return { user, effectivePermissions };
}

export function getRequestAuthorization(session: SessionContext): Promise<RequestAuthorization> {
    const previous = requestAuthorizations.get(session);
    if (previous && previous.userId === session.userId && previous.handle === session.$handle) {
        return previous.authorization; // existing.
    }

    const entry = {
        userId: session.userId,
        handle: session.$handle,
        authorization: refreshAuthorization(session),
    };
    requestAuthorizations.set(session, entry);
    return entry.authorization;
}
