import { AuthorizationError, NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import type { MergeIdentity, UserMergeParticipants } from "../../userMergeSchemas";
import { PermissionSet } from "../../shared/PermissionSet";
import { canManageUser, type UserManagementActor } from "../userManagementPolicy";
import { makePermissionSetFromRole, makeUserManagementTarget } from "../userManagementState";
import { mergeUserInclude, type MergeAuthority, type MergeCandidate, type MergeContext, type MergeDatabase, type MergeUser } from "./types";

export async function authorizeMergeActor(db: MergeDatabase, authority: MergeAuthority): Promise<UserManagementActor> {
    if (authority.isImpersonating) {
        throw new AuthorizationError();
    }
    const auth = (await authority.authorization.refresh(db)).requireUser();
    auth.requirePermission(Permission.merge_users);
    auth.requirePermission(Permission.manage_global_users);
    return { principal: auth.user, auth };
}
export function canMergeAccount(actor: UserManagementActor, target: MergeCandidate): boolean {
    if (!canManageUser({ actor, target: makeUserManagementTarget(target), action: "merge" })) {
        return false;
    }
    if (actor.auth.hasPermission(Permission.sysadmin)) {
        return true;
    }
    if (target.isSysAdmin) {
        return false;
    }
    // A selected-band grant cannot authorize account-wide changes in other bands.
    const globalEnvelope = makePermissionSetFromRole(actor.auth.user?.globalRole);
    if (!globalEnvelope.hasAllDelegable(makeUserManagementTarget(target).rolePermissions)) {
        return false;
    }
    return target.bandUsersByUser.every(member => {
        const grants = member.bandRole && !member.bandRole.isDeleted
            ? member.bandRole.bandRolePermissions.filter(grant => !grant.permission.isDeleted).map(grant => grant.permission.name) : [];
        return globalEnvelope.hasAllDelegable(new PermissionSet(grants));
    });
}
export async function loadEligibleMergeUser(db: MergeDatabase, actor: UserManagementActor, userId: UserPublicId): Promise<MergeUser> {
    const user = await db.user.findUnique({ where: { publicId: userId }, include: mergeUserInclude });
    if (!user) {
        throw new NotFoundError();
    }
    if (!canMergeAccount(actor, user)) {
        throw new AuthorizationError("Not authorized to merge this account.");
    }
    return user;
}
export async function loadMergeContext(db: MergeDatabase, authority: MergeAuthority, participants: UserMergeParticipants): Promise<MergeContext> {
    const actor = await authorizeMergeActor(db, authority);
    if (participants.mainUserId === participants.retiringUserId) {
        throw new AuthorizationError("Choose two different accounts.");
    }
    const main = await loadEligibleMergeUser(db, actor, participants.mainUserId);
    const retiring = await loadEligibleMergeUser(db, actor, participants.retiringUserId);
    const mainByBand = new Map(main.bandUsersByUser.map(member => [member.bandId, member]));
    return { db, authorization: actor.auth, main, retiring, mainUserId: main.id, retiringUserId: retiring.id,
        memberships: retiring.bandUsersByUser.map(member => ({ main: mainByBand.get(member.bandId) ?? null, retiring: member })) };
}
export async function mergeIdentity(db: MergeDatabase, user: MergeCandidate, locale: LocalePreferenceInput): Promise<MergeIdentity> {
    const labels = await resolveAuthorizedDynamicStrings(db, { band: null }, user.globalRole ? [user.globalRole.nameId] : [], locale);
    return { publicId: parsePublicId<"User">(user.publicId), name: user.name, email: user.email, createdAt: user.createdAt,
        roleId: user.globalRole ? parsePublicId<"GlobalRole">(user.globalRole.publicId) : null,
        roleName: user.globalRole ? labels.get(user.globalRole.nameId)?.value ?? null : null, isDeleted: user.isDeleted, isSysAdmin: user.isSysAdmin };
}
