import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { getPermissionDefinition, gContinuitySensitivePermissions, gPermissionOrdered, Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";

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
                        name: true, isDeleted: true
                    }
                }
            }
        },
    },
});
type AssignmentRole = Prisma.BandRoleGetPayload<typeof roleSelection>;

// Sysadmin authority can come from the account flag or its active global role.
const platformSysadminWhere = Prisma.validator<Prisma.UserWhereInput>()({
    OR: [
        { isSysAdmin: true },
        {
            globalRole: {
                isDeleted: false,
                permissions: {
                    some: {
                        permission: {
                            name: Permission.sysadmin,
                            isDeleted: false
                        }
                    }
                }
            }
        },
    ],
});

export function roleGrants(role: AssignmentRole | undefined): PermissionSet {
    return new PermissionSet(role && !role.isDeleted ? role.bandRolePermissions
        .filter(grant => !grant.permission.isDeleted).map(grant => grant.permission.name) : []);
}

export function requireDelegableRoles(auth: CMServerAuthorization, current: PermissionSet, desired: PermissionSet): void {
    if (!auth.hasPermission(Permission.sysadmin)
        && (!auth.hasAllDelegable(current) || !auth.hasAllDelegable(desired))) {
        throw new AuthorizationError("The membership role is outside your delegation authority.");
    }
}

/** Roleless memberships receive the designated new-member role, plus the public role. */
export function effectiveMemberRoleGrants(roles: readonly AssignmentRole[], roleId: number | null): PermissionSet {
    return new PermissionSet(roles.filter(role => !role.isDeleted && (role.isPublicRole
        || (roleId === null ? role.isRoleForNewUsers : role.id === roleId)))
        .flatMap(role => roleGrants(role).names));
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
    const roles = await database.bandRole.findMany(roleSelection);
    if (roles.filter(role => !role.isDeleted && role.isRoleForNewUsers).length > 1
        || roles.filter(role => !role.isDeleted && role.isPublicRole).length > 1) {
        throw new Error("Ambiguous active public or new-member role designation.");
    }
    return roles;
}

/** Inactive memberships retain only the band's public grants. */
export function publicBandRoleGrants(roles: readonly AssignmentRole[]): PermissionSet {
    return new PermissionSet(roles.filter(role => role.isPublicRole).flatMap(role => roleGrants(role).names));
}
