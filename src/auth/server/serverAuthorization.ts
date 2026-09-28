import { getPermissionDefinition, isPermission, Permission } from "@/shared/permissions";
import { parsePublicId, UserPublicId } from "@/shared/publicId";
import type { SessionContext } from "@blitzjs/auth";
import { AuthenticationError, AuthorizationError } from "blitz";
import db from "db";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { UserWithRolesArgs, type UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";
import type { PublicDataType } from "types";
import { IAuthorization } from "../shared/cmAuthorization";
import { PermissionSet } from "../shared/PermissionSet";
import { loadEffectivePermissions } from "./effectivePermissions";
import { ServerPermissionSet } from "./ServerPermissionSet";

const loadFreshPrincipal = (
    database: TransactionalPrismaClient,
    userId: number | null | undefined,
): Promise<UserWithRolesPayload | null> => userId
        ? database.user.findFirst({
            ...UserWithRolesArgs,
            where: { id: userId, isDeleted: false },
        })
        : Promise.resolve(null);


export class CMServerAuthorization implements IAuthorization {
    readonly user: UserWithRolesPayload | null;
    readonly userId: number | null;
    readonly userPublicId: UserPublicId | null;
    readonly sessionHandle: string | null;

    readonly effectivePermissions: ServerPermissionSet;

    constructor(
        user: UserWithRolesPayload | null,
        effectivePermissions: ServerPermissionSet,
        sessionHandle: string | null = null,
    ) {
        if (!(effectivePermissions instanceof ServerPermissionSet)) {
            throw new Error("Server effective permissions are required.");
        }
        this.user = user;
        this.userId = user?.id ?? null;
        // don't use xUser.parseIdentity, because it creates a dependency cycle
        this.userPublicId = user?.publicId ? parsePublicId<"User">(user.publicId) : null;
        this.effectivePermissions = effectivePermissions;
        this.sessionHandle = sessionHandle;
    }

    hasPermission(permission: Permission): boolean {
        return this.effectivePermissions.includesName(permission);
    }

    requirePermission(permission: Permission): void {
        if (!this.hasPermission(permission)) {
            if (!this.user) throw new AuthenticationError(`Not authorized for ${permission}.`);
            throw new AuthorizationError(`Not authorized for ${permission}.`);
        }
    }

    requireUser(): CMServerAuthorizationWithUser {
        if (!this.user) throw new AuthenticationError("An active user is required.");
        return new CMServerAuthorizationWithUser(this.user, this.effectivePermissions, this.sessionHandle);
    }

    hasAllDelegable(other: Readonly<PermissionSet>): boolean {
        return other.names.every(name => isPermission(name)
            && getPermissionDefinition(name).isDelegable
            && this.hasPermission(name));
    }

    async refresh(database: TransactionalPrismaClient = db): Promise<CMServerAuthorization> {
        const user = await loadFreshPrincipal(database, this.userId);
        return new CMServerAuthorization(user, await loadEffectivePermissions(database, user), this.sessionHandle);
    }
}

// same thing but with non-null user.
export class CMServerAuthorizationWithUser extends CMServerAuthorization {
    declare readonly user: UserWithRolesPayload;
    declare readonly userId: number;
    declare readonly userPublicId: UserPublicId;
    constructor(
        user: UserWithRolesPayload,
        effectivePermissions: ServerPermissionSet,
        sessionHandle: string | null = null,
    ) {
        super(user, effectivePermissions, sessionHandle);
    }
}





const serverAuthorizations = new WeakMap<SessionContext, {
    userId: number | null;
    handle: string | null; // session.$handle
    authorization: Promise<CMServerAuthorization>;
}>();

async function loadSessionAuthorization(session: SessionContext): Promise<CMServerAuthorization> {
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

    return new CMServerAuthorization(user, effectivePermissions, session.$handle);
}

export function loadAuthorization(session: SessionContext): Promise<CMServerAuthorization> {
    const previous = serverAuthorizations.get(session);
    if (previous && previous.userId === session.userId && previous.handle === session.$handle) {
        return previous.authorization; // existing.
    }

    const entry = {
        userId: session.userId,
        handle: session.$handle,
        authorization: loadSessionAuthorization(session),
    };
    serverAuthorizations.set(session, entry);
    return entry.authorization;
}

// Non-session entry points (for example calendar subscriptions) resolve the same effective grants as ordinary requests.
export async function loadAuthorizationForUser(
    user: UserWithRolesPayload | null,
    database: TransactionalPrismaClient = db,
): Promise<CMServerAuthorization> {
    return new CMServerAuthorization(user, await loadEffectivePermissions(database, user));
}
