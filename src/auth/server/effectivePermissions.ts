import { Prisma } from "@prisma/client";
import { AuthenticationError } from "blitz";
import { getPermissionDefinition, isPermission, Permission, type PermissionScope } from "shared/permissions";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { CreatePublicData, type CreatePublicDataArgs, type PublicDataType } from "types";
import { ServerPermissionSet, type DatabasePermissionIdentity } from "./ServerPermissionSet";
import {
    membershipSelection, type AuthorizationDatabase, type AuthorizationMembership,
} from "./authorizationContext";

export type PermissionPrincipal = Readonly<{
    id: number;
    globalRoleId: number | null;
    isSysAdmin: boolean;
    isDeleted: boolean;
    mergedIntoUserId: number | null;
}>;

const grantSelection = Prisma.validator<Prisma.GlobalRolePermissionSelect>()({
    permission: { select: { id: true, name: true, isDeleted: true } },
});
type PersistedGrant = Prisma.GlobalRolePermissionGetPayload<{ select: typeof grantSelection }>;

export interface EffectivePermissionContext {
    readonly effectivePermissions: ServerPermissionSet;
    readonly globalPermissions: ServerPermissionSet;
    readonly bandPermissions: ServerPermissionSet;
    /** Only the selected global role contributes to the shared session. */
    readonly sessionPermissions: ServerPermissionSet;
    readonly membership: AuthorizationMembership | null;
}

function rolePermissions(entries: readonly PersistedGrant[], scope: PermissionScope): ServerPermissionSet {
    const unknown = new Set<string>();
    const permissions: DatabasePermissionIdentity[] = [];
    for (const { permission } of entries) {
        if (permission.isDeleted || permission.name === Permission.never_grant) {
            continue;
        }
        if (!isPermission(permission.name)) {
            unknown.add(permission.name);
            continue;
        }
        if (getPermissionDefinition(permission.name).scope !== scope) {
            throw new Error(`A ${scope} role cannot grant ${permission.name}.`);
        }
        permissions.push({ id: permission.id, name: permission.name });
    }
    if (unknown.size) {
        console.warn(`Ignoring unknown persisted permissions: ${[...unknown].join(", ")}`);
    }
    return new ServerPermissionSet(permissions);
}

async function loadGlobalRolePermissions(
    database: AuthorizationDatabase,
    roleId: number | null,
): Promise<ServerPermissionSet> {
    const roles = await database.globalRole.findMany({
        where: { isDeleted: false, ...(roleId === null ? { isPublicRole: true } : { id: roleId }) },
        select: { permissions: { select: grantSelection } },
    });
    if (roles.length !== 1) {
        throw new Error(roleId === null
            ? "Expected exactly one active Global Public role."
            : "The assigned global role is unavailable.");
    }
    return rolePermissions(roles[0]!.permissions, "global");
}

async function loadBandRolePermissions(
    database: AuthorizationDatabase,
    roleId: number | null,
): Promise<ServerPermissionSet> {
    const roles = await database.bandRole.findMany({
        where: { isDeleted: false, ...(roleId === null ? { isPublicRole: true } : { id: roleId }) },
        select: { bandRolePermissions: { select: grantSelection } },
    });
    if (roles.length !== 1) {
        throw new Error(roleId === null
            ? "Expected exactly one active Band Public role."
            : "The assigned band role is unavailable.");
    }
    return rolePermissions(roles[0]!.bandRolePermissions, "band");
}

export async function loadEffectivePermissionContext(
    database: AuthorizationDatabase,
    principal: PermissionPrincipal | null | undefined,
    bandId: number | null,
): Promise<EffectivePermissionContext> {
    const user = principal && !principal.isDeleted && principal.mergedIntoUserId === null ? principal : null;
    const membership = user && bandId !== null ? await database.bandUser.findUnique({
        where: { bandId_userId: { bandId, userId: user.id } },
        select: membershipSelection,
    }) : null;
    const activeMembership = membership && !membership.isDeleted ? membership : null;
    const globalPermissions = await loadGlobalRolePermissions(database, user?.globalRoleId ?? null);
    const bandPermissions = bandId === null ? new ServerPermissionSet([])
        : await loadBandRolePermissions(database, activeMembership?.bandRoleId ?? null);
    return {
        effectivePermissions: new ServerPermissionSet([...globalPermissions.entries, ...bandPermissions.entries]),
        globalPermissions,
        bandPermissions,
        sessionPermissions: globalPermissions,
        membership: activeMembership,
    };
}

// note that this is really specific to the current user; there are small policies that
// only work there. for example a deactivated account is treated as anonymous. this can't be
// used on principal targets because t hat logic is not applicable there.
export async function loadEffectivePermissions(
    database: AuthorizationDatabase,
    user: PermissionPrincipal | null | undefined,
    bandId: number | null = null,
): Promise<ServerPermissionSet> {
    return (await loadEffectivePermissionContext(database, user, bandId)).effectivePermissions;
}

export const createPublicDataFromDatabase = async (
    database: AuthorizationDatabase,
    args: Omit<CreatePublicDataArgs, "permissions">,
): Promise<PublicDataType> => {
    const user = args.user ? await database.user.findFirst({
        ...UserWithRolesArgs,
        where: { id: args.user.id, isDeleted: false, mergedIntoUserId: null },
    }) : null;
    if (args.user && !user) {
        throw new AuthenticationError();
    }
    const { sessionPermissions } = await loadEffectivePermissionContext(database, user, null);
    return CreatePublicData({ ...args, user, permissions: sessionPermissions.names });
};
