import { gContinuitySensitivePermissions, gPermissionOrdered, getPermissionDefinition, Permission } from "shared/permissions";
import { loadGlobalPublicRoleGrants, makePermissionSetFromRole } from "../userManagementState";
import type { MergeCandidate, MergeContext, MergeMembership } from "./types";
import { mergeCandidateSelect } from "./types";
import { effectiveMemberRoleGrants, loadMemberRoles } from "src/core/db3/server/db3BandMemberPolicy";

/** Only ordinary active holders count for continuity; Sysadmin recovery remains a separate fallback. */
export async function membershipContinuityWarnings(context: MergeContext): Promise<string[]> {
    const publicGlobalGrants = await loadGlobalPublicRoleGrants(context.db);
    const globalGrants = (user: MergeCandidate) => user.globalRole ? makePermissionSetFromRole(user.globalRole) : publicGlobalGrants;
    if (context.retiring.isDeleted || globalGrants(context.retiring).includesName(Permission.sysadmin)) {
        return [];
    }
    const roles = await loadMemberRoles(context.db);
    const membershipGrants = (membership: MergeMembership | undefined) => effectiveMemberRoleGrants(roles,
        membership && !membership.isDeleted && !membership.band.isDeleted ? membership.bandRoleId : null);
    const userBandGrants = (user: MergeCandidate, bandId: number) => membershipGrants(user.bandUsersByUser.find(member => member.bandId === bandId));
    const users = await context.db.user.findMany({ where: { isDeleted: false, mergedIntoUserId: null }, select: mergeCandidateSelect, orderBy: { id: "asc" } });
    const warnings: string[] = [];
    for (const pair of context.memberships) {
        const bandId = pair.retiring.bandId;
        if (pair.retiring.isDeleted || pair.retiring.band.isDeleted) {
            continue;
        }
        const retiringGrants = userBandGrants(context.retiring, bandId);
        const resultingGrants = membershipGrants(pair.main ?? undefined);
        const lost = gPermissionOrdered.filter(permission => getPermissionDefinition(permission).scope === "band"
            && gContinuitySensitivePermissions.has(permission) && retiringGrants.includesName(permission) && !resultingGrants.includesName(permission)
            && !users.some(user => user.id !== context.retiringUserId && user.id !== context.mainUserId
                && !globalGrants(user).includesName(Permission.sysadmin) && userBandGrants(user, bandId).includesName(permission)));
        if (lost.length) {
            warnings.push("Band " + pair.retiring.band.publicId + " loses its last ordinary account holder of: " + lost.join(", ") + ". Main retains its own privileges.");
        }
    }
    return warnings;
}
