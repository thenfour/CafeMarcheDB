import { Permission } from "@/shared/permissions";
import type { SessionContext } from "@blitzjs/auth";
import { AuthenticationError } from "blitz";
import db from "db";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import type { UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import type { PublicDataType } from "types";
import type { PermissionSet } from "../shared/PermissionSet";
import { loadEffectivePermissions } from "./effectivePermissions";
import { loadFreshPrincipal } from "./permissionAuthorization";

// Blitz creates a SessionContext for each request
// use that as a cache key for request authorizations.

export interface RequestAuthorization {
    user: UserWithRolesPayload | null;
    effectivePermissions: PermissionSet;
}

const requestAuthorizations = new WeakMap<SessionContext, {
    userId: number | null;
    handle: string | null; // session.$handle
    authorization: Promise<RequestAuthorization>;
}>();

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

// Non-session entry points (for example calendar subscriptions) resolve the same effective grants as ordinary requests.
export async function loadUserAuthorization(user: UserWithRolesPayload | null, database: TransactionalPrismaClient = db): Promise<RequestAuthorization> {
    return { user, effectivePermissions: await loadEffectivePermissions(database, user) };
}

export const requirePermission = (auth: RequestAuthorization, permission: Permission): void => {
    if (!auth.effectivePermissions.includesName(permission)) {
        throw new AuthenticationError(`Missing required permission: ${permission}`);
    }
}

// named like this to avoid collision with the imported includesPermission from "shared/permissions"
export const authIncludesPermission = (auth: RequestAuthorization, permission: Permission) => {
    return auth.effectivePermissions.includesName(permission);
}
