import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import type { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bandUserRoleCommand, type BandUserRoleEdit } from "../../shared/entities/user/bandUserRoles";
import { xBandUser } from "../../shared/entities/user/bandUser";
import { defineCommandHandler } from "../db3CommandCore";
import { effectiveMemberRoleGrants, findContinuityWarnings, loadMemberRoles, requireDelegableRoles, roleGrants } from "../db3BandMemberPolicy";
import { requireActiveBandMembership } from "../db3MemberAssignments";

/** The shared command endpoint supplies Serializable execution and refreshed authorization. */
export async function assignBandUserRole(database: Prisma.TransactionClient, auth: CMServerAuthorization, rawEdit: BandUserRoleEdit) {
    const edit = bandUserRoleCommand.parseDto(rawEdit);
    auth.requirePermission(BandPermission.assign_user_roles);
    const membership = await requireActiveBandMembership(database, auth, edit.membershipId);
    const roles = await loadMemberRoles(database);
    const desiredRole = edit.roleId === null ? undefined : roles.find(role => role.publicId === edit.roleId && !role.isDeleted);
    if (edit.roleId !== null && !desiredRole) {
        throw new NotFoundError();
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
