import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { getPermissionDefinition, gContinuitySensitivePermissions, gPermissionOrdered, Permission, asPermission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadPlatformSysadminWhere } from "src/auth/server/principalPredicates";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { canDelegateBandRoleGrants } from "src/auth/shared/bandRolePolicy";

const roleSelection = Prisma.validator<Prisma.BandRoleDefaultArgs>()({
    select: {
        id: true,
        publicId: true,
        isDeleted: true,
        isPublicRole: true,
        isRoleForNewUsers: true,
        bandRolePermissions:
        {
            select: {
                permission: {
                    select: {
                        name: true,
                        isDeleted: true
                    }
                }
            }
        },
    },
});

// needed because the above has name: string rather than Permission.
type AssignmentRole = {
    id: number;
    publicId: string;
    isDeleted: boolean;
    isPublicRole: boolean;
    isRoleForNewUsers: boolean;
    bandRolePermissions: {
        permission: {
            name: Permission;
            isDeleted: boolean;
        }
    }[];
}

export function roleGrants(role: AssignmentRole | undefined): PermissionSet {
    const isActiveRole = role && !role.isDeleted;
    if (!isActiveRole) {
        return new PermissionSet([]);
    }
    return new PermissionSet(role.bandRolePermissions
        .filter(grant => !grant.permission.isDeleted)
        .map(grant => grant.permission.name));
}

export function requireDelegableRoles(auth: CMServerAuthorization, current: PermissionSet, desired: PermissionSet): void {
    if (!canDelegateBandRoleGrants(auth, current.names) || !canDelegateBandRoleGrants(auth, desired.names)) {
        throw new AuthorizationError("The membership role is outside your delegation authority.");
    }
}

/** One membership role occupies the band slot; unassigned memberships use Public. */
export function effectiveMemberRoleGrants(roles: readonly AssignmentRole[], roleId: number | null): PermissionSet {
    const assigned = roles.find(role => role.id === roleId && !role.isDeleted);
    return roleId === null ? publicBandRoleGrants(roles) : roleGrants(assigned);
}

// warn when a band would become unmanageable due to loss of critical permissions
export async function findContinuityWarnings(
    database: Prisma.TransactionClient,
    auth: CMServerAuthorization,
    target: {
        readonly id: number;
        readonly userId: number,
    },
    current: PermissionSet,
    desired: PermissionSet,
    roles: readonly AssignmentRole[],
): Promise<Permission[]> {
    const lost = gPermissionOrdered.filter(permission => getPermissionDefinition(permission).scope === "band"
        && gContinuitySensitivePermissions.has(permission) && current.includesName(permission) && !desired.includesName(permission));
    if (lost.length === 0) {
        return [];
    }
    const platformSysadminWhere = await loadPlatformSysadminWhere(database);
    const platformAdministrator = await database.user.findFirst({
        where: {
            id: target.userId,
            ...platformSysadminWhere
        },
        select: { id: true }
    });
    if (platformAdministrator) {
        return [];
    }
    // A global administrator must not hide the loss of ordinary band administration.
    const others = await database.bandUser.findMany({
        where: {
            bandId: auth.requireBand().id,
            isDeleted: false,
            id: { not: target.id },
            user: {
                isDeleted: false,
                mergedIntoUserId: null,
                NOT: platformSysadminWhere
            },
        },
        select: { bandRoleId: true },
    });
    const grants = others.map(member => effectiveMemberRoleGrants(roles, member.bandRoleId));
    return lost.filter(permission => !grants.some(other => other.includesName(permission)));
}

/** Role assignment and lifecycle commands validate the same platform-owned role definitions. */
export async function loadMemberRoles(database: Prisma.TransactionClient): Promise<AssignmentRole[]> {
    // lsmb todo: use a view with proper hydration.
    const roles = await database.bandRole.findMany(roleSelection);
    if (roles.filter(role => !role.isDeleted && role.isPublicRole).length !== 1) {
        throw new Error("Authorization requires exactly one active Public band role.");
    }

    return roles.map(role => ({
        ...role,
        bandRolePermissions: role.bandRolePermissions.map(brp => ({
            permission: {
                ...brp.permission,
                name: asPermission(brp.permission.name),
            }
        }))
    }));
}

/** Inactive memberships retain only the band's public grants. */
export function publicBandRoleGrants(roles: readonly AssignmentRole[]): PermissionSet {
    return new PermissionSet(roles.filter(role => role.isPublicRole).flatMap(role => roleGrants(role).names));
}
