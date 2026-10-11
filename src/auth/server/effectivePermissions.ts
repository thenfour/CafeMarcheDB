import { Prisma } from "@prisma/client";
import { AuthenticationError } from "blitz";
import { getPermissionDefinition, isPermission, Permission } from "shared/permissions";
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
type RecognizedPermission = DatabasePermissionIdentity & { readonly name: Permission };

export interface EffectivePermissionContext {
    readonly effectivePermissions: ServerPermissionSet;
    readonly globalPermissions: ServerPermissionSet;
    readonly bandPermissions: ServerPermissionSet;
    /** Band-independent display grants for the shared session. */
    readonly sessionPermissions: ServerPermissionSet;
    readonly membership: AuthorizationMembership | null;
}

function recognizedGrants(entries: readonly PersistedGrant[]): RecognizedPermission[] {
    const unknown = new Set<string>();
    const permissions = entries.flatMap<RecognizedPermission>(({ permission }) => {
        if (permission.isDeleted || permission.name === Permission.never_grant) return [];
        if (!isPermission(permission.name)) { unknown.add(permission.name); return []; }
        return [{ id: permission.id, name: permission.name }];
    });
    if (unknown.size) console.warn(`Ignoring unknown persisted permissions: ${[...unknown].join(", ")}`);
    return permissions;
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

    const globalRoles = user ? await database.globalRole.findMany({
        where: {
            isDeleted: false,
            OR: [
                ...(user.globalRoleId === null ? [] : [{ id: user.globalRoleId }]),
                ...(user.isSysAdmin ? [{ isSysAdminRole: true }] : []),
            ],
        },
        select: { id: true, isSysAdminRole: true, permissions: { select: grantSelection } },
    }) : [];
    if (user?.isSysAdmin && globalRoles.filter(role => role.isSysAdminRole).length !== 1) {
        throw new Error("Expected exactly one active designated Sysadmin role.");
    }

    // The public definition is shared, but any band grants on it still require
    // a band context. The new-user role applies only to an active roleless member.
    const storedBandRoles = await database.bandRole.findMany({
        where: {
            isDeleted: false,
            OR: [
                { isPublicRole: true },
                ...(activeMembership?.bandRoleId == null ? [] : [{ id: activeMembership.bandRoleId }]),
                ...(activeMembership?.bandRoleId === null ? [{ isRoleForNewUsers: true }] : []),
            ],
        },
        select: { id: true, isPublicRole: true, isRoleForNewUsers: true, bandRolePermissions: { select: grantSelection } },
    });
    const ambiguousBandDesignations = storedBandRoles.filter(role => role.isPublicRole).length > 1
        || storedBandRoles.filter(role => role.isRoleForNewUsers).length > 1;
    if (bandId !== null && ambiguousBandDesignations) {
        throw new Error("Ambiguous active public or new-member role designation.");
    }
    // Invalid band definitions confer no public grants in platform context.
    // Independently validated global/account authority remains usable for their repair.
    const bandRoles = ambiguousBandDesignations ? [] : storedBandRoles;

    // Login and logged-in visibility describe the global account, independently
    // of whether the person has joined a band or received a membership role.
    const accountPermissions = user ? await database.permission.findMany({
        where: { name: { in: [Permission.login, Permission.visibility_logged_in_users] }, isDeleted: false },
        select: { id: true, name: true },
    }) : [];
    const global = recognizedGrants(globalRoles.flatMap(role => role.permissions))
        .filter(permission => bandId !== null || getPermissionDefinition(permission.name).scope !== "band");
    const band = recognizedGrants(bandRoles.flatMap(role => role.bandRolePermissions)).filter(permission => {
        // The registry, not persisted grants, determines enforceable scope.
        const scope = getPermissionDefinition(permission.name).scope;
        return scope !== "platform" && (scope !== "account" || !!user) && (scope !== "band" || bandId !== null);
    });
    const globalPermissions = new ServerPermissionSet([...global, ...accountPermissions]);
    const bandPermissions = new ServerPermissionSet(band);
    // Public/account grants from the shared public definition are independent
    // of membership. Grants from a selected member role stay in its context.
    const publicPermissionIds = new Set(bandRoles.filter(role => role.isPublicRole)
        .flatMap(role => role.bandRolePermissions.map(grant => grant.permission.id)));
    const sessionPermissions = new ServerPermissionSet([
        ...global.filter(permission => getPermissionDefinition(permission.name).scope !== "band"),
        ...accountPermissions,
        ...band.filter(permission => publicPermissionIds.has(permission.id)
            && getPermissionDefinition(permission.name).scope !== "band"),
    ]);
    return {
        effectivePermissions: new ServerPermissionSet([...global, ...accountPermissions, ...band]),
        globalPermissions,
        bandPermissions,
        sessionPermissions,
        membership: activeMembership,
    };
}

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
    if (args.user && !user) throw new AuthenticationError();
    const { sessionPermissions } = await loadEffectivePermissionContext(database, user, null);
    return CreatePublicData({ ...args, user, permissions: sessionPermissions.names });
};
