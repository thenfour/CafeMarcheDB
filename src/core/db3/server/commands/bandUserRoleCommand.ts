import { Prisma } from "@prisma/client";
import { AuthorizationError, NotFoundError } from "blitz";
import { getPermissionDefinition, gContinuitySensitivePermissions, gPermissionOrdered, Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { bandUserRoleCommand, type BandUserRoleEdit } from "../../shared/entities/user/bandUserRoles";
import { xBandUser } from "../../shared/entities/user/bandUser";
import { defineCommandHandler } from "../db3CommandCore";
import { requireActiveBandMembership } from "../db3MemberAssignments";

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

function roleGrants(role: AssignmentRole | undefined): PermissionSet {
    return new PermissionSet(role && !role.isDeleted ? role.bandRolePermissions
        .filter(grant => !grant.permission.isDeleted).map(grant => grant.permission.name) : []);
}

function requireDelegableRoles(auth: CMServerAuthorization, current: PermissionSet, desired: PermissionSet): void {
    if (!auth.hasPermission(Permission.sysadmin)
        && (!auth.hasAllDelegable(current) || !auth.hasAllDelegable(desired))) {
        throw new AuthorizationError("The membership role is outside your delegation authority.");
    }
}

/** Roleless memberships receive the designated new-member role, plus the public role. */
function effectiveMemberRoleGrants(roles: readonly AssignmentRole[], roleId: number | null): PermissionSet {
    return new PermissionSet(roles.filter(role => !role.isDeleted && (role.isPublicRole
        || (roleId === null ? role.isRoleForNewUsers : role.id === roleId)))
        .flatMap(role => roleGrants(role).names));
}

// warn when a band would become unmanageable due to loss of critical permissions
async function findContinuityWarnings(
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
    const person = await database.user.findUniqueOrThrow({ where: { id: target.userId }, select: { isSysAdmin: true } });
    if (person.isSysAdmin) {
        return [];
    }
    // A global administrator must not hide the loss of ordinary band administration.
    const others = await database.bandUser.findMany({
        where: {
            bandId: auth.requireBand().id, isDeleted: false, id: { not: target.id },
            user: { isDeleted: false, mergedIntoUserId: null, isSysAdmin: false },
        },
        select: { bandRoleId: true },
    });
    const grants = others.map(member => effectiveMemberRoleGrants(roles, member.bandRoleId));
    return lost.filter(permission => !grants.some(other => other.includesName(permission)));
}

/** The shared command endpoint supplies Serializable execution and refreshed authorization. */
export async function assignBandUserRole(database: Prisma.TransactionClient, auth: CMServerAuthorization, rawEdit: BandUserRoleEdit) {
    const edit = bandUserRoleCommand.parseDto(rawEdit);
    auth.requirePermission(Permission.assign_user_roles);
    const membership = await requireActiveBandMembership(database, auth, edit.membershipId);
    const roles = await database.bandRole.findMany(roleSelection);
    const desiredRole = edit.roleId === null ? undefined : roles.find(role => role.publicId === edit.roleId && !role.isDeleted);
    if (edit.roleId !== null && !desiredRole) {
        throw new NotFoundError();
    }
    if (roles.filter(role => !role.isDeleted && role.isRoleForNewUsers).length > 1
        || roles.filter(role => !role.isDeleted && role.isPublicRole).length > 1) {
        throw new Error("Ambiguous active public or new-member role designation.");
    }
    const desiredRoleId = desiredRole?.id ?? null;
    const current = effectiveMemberRoleGrants(roles, membership.bandRoleId);
    const desired = effectiveMemberRoleGrants(roles, desiredRoleId);
    // Check the complete stored role grant sets too; ignored unknown/platform grants are not delegable.
    requireDelegableRoles(auth, roleGrants(roles.find(role => role.id === membership.bandRoleId)), roleGrants(desiredRole));
    requireDelegableRoles(auth, current, desired);
    const identity = { membershipId: xBandUser.parseIdentity(membership.publicId), roleId: edit.roleId };
    if (membership.bandRoleId === desiredRoleId) {
        return bandUserRoleCommand.parseResult({ ...identity, status: "saved" });
    }
    const permissions = await findContinuityWarnings(database, auth, membership, current, desired, roles);
    if (permissions.length > 0 && !edit.acknowledgeContinuityRisk) {
        return bandUserRoleCommand.parseResult({ ...identity, status: "confirmationRequired", permissions });
    }
    await database.bandUser.update({
        where: { id: membership.id }, data: { bandRoleId: desiredRoleId, updatedByUserId: auth.userId },
    });
    await RegisterChange({
        action: ChangeAction.update,
        changeContext: CreateChangeContext(bandUserRoleCommand.commandID),
        table: "bandUser",
        pkid: membership.id,
        oldValues: { bandRoleId: membership.bandRoleId },
        newValues: { bandRoleId: desiredRoleId },
        auth,
        db: database,
    });
    return bandUserRoleCommand.parseResult({ ...identity, status: "saved" });
}

export const bandUserRoleCommandHandler = defineCommandHandler(bandUserRoleCommand,
    (edit, context) => assignBandUserRole(context.transaction, context.authorization, edit));
