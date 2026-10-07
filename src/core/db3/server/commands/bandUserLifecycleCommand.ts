import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { xBandUser } from "../../shared/entities/user/bandUser";
import { bandUserLifecycleCommand, type BandUserLifecycleEdit } from "../../shared/entities/user/bandUserLifecycle";
import { effectiveMemberRoleGrants, findContinuityWarnings, loadMemberRoles, publicBandRoleGrants, requireDelegableRoles, roleGrants } from "../db3BandMemberPolicy";
import { defineCommandHandler } from "../db3CommandCore";

async function requireLifecycleMembership(database: Prisma.TransactionClient, auth: CMServerAuthorization, edit: BandUserLifecycleEdit) {
    auth.requirePermission(Permission.login);
    auth.requirePermission(edit.action === "deactivate" ? Permission.deactivate_users : Permission.recover_users);
    const membership = await database.bandUser.findFirst({
        where: { publicId: edit.membershipId, bandId: auth.requireBand().id,
            user: { isDeleted: false, mergedIntoUserId: null } },
    });
    if (!membership) {
        throw new AuthorizationError("The membership cannot change status.");
    }
    return membership;
}

/** The shared command endpoint owns Serializable execution and authorization refresh. */
export async function setBandUserActive(database: Prisma.TransactionClient, auth: CMServerAuthorization, rawEdit: BandUserLifecycleEdit) {
    const edit = bandUserLifecycleCommand.parseDto(rawEdit);
    const membership = await requireLifecycleMembership(database, auth, edit);
    const roles = await loadMemberRoles(database);
    const active = effectiveMemberRoleGrants(roles, membership.bandRoleId);
    const inactive = publicBandRoleGrants(roles);
    // Restoring a stored role grants it again; both actions need authority over that role.
    requireDelegableRoles(auth, roleGrants(roles.find(role => role.id === membership.bandRoleId)), active);
    const isDeleted = edit.action === "deactivate";
    const identity = { membershipId: xBandUser.parseIdentity(membership.publicId), isDeleted };
    if (membership.isDeleted === isDeleted) {
        return bandUserLifecycleCommand.parseResult({ ...identity, status: "saved" });
    }
    const permissions = isDeleted ? await findContinuityWarnings(database, auth, membership, active, inactive, roles) : [];
    if (permissions.length > 0 && !edit.acknowledgeContinuityRisk) {
        return bandUserLifecycleCommand.parseResult({ ...identity, status: "confirmationRequired", permissions });
    }
    await database.bandUser.update({ where: { id: membership.id }, data: { isDeleted, updatedByUserId: auth.userId } });
    await RegisterChange({
        action: ChangeAction.update, changeContext: CreateChangeContext(bandUserLifecycleCommand.commandID),
        table: "bandUser", pkid: membership.id,
        oldValues: { isDeleted: membership.isDeleted }, newValues: { isDeleted }, auth, db: database,
    });
    return bandUserLifecycleCommand.parseResult({ ...identity, status: "saved" });
}

export const bandUserLifecycleCommandHandler = defineCommandHandler(bandUserLifecycleCommand,
    (edit, context) => setBandUserActive(context.transaction, context.authorization, edit));
