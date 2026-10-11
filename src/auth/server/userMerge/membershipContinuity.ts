import { gContinuitySensitivePermissions, gPermissionOrdered, getPermissionDefinition, Permission } from "shared/permissions";
import { PermissionSet } from "../../shared/PermissionSet";
import { makePermissionSetFromRole } from "../userManagementState";
import type { MergeCandidate, MergeContext, MergeMembership } from "./types";
import { mergeCandidateSelect } from "./types";

function membershipGrants(membership: MergeMembership | undefined): string[] {
    const role = membership && !membership.isDeleted && !membership.band.isDeleted ? membership.bandRole : null;
    return role && !role.isDeleted ? role.bandRolePermissions.filter(grant => !grant.permission.isDeleted).map(grant => grant.permission.name) : [];
}
function userBandGrants(user: MergeCandidate, bandId: number): PermissionSet {
    return new PermissionSet([...makePermissionSetFromRole(user.globalRole).names,
        ...membershipGrants(user.bandUsersByUser.find(member => member.bandId === bandId))]);
}

/** Only ordinary active holders count for continuity; Sysadmin recovery remains a separate fallback. */
export async function membershipContinuityWarnings(context: MergeContext): Promise<string[]> {
    if (context.retiring.isDeleted || context.retiring.isSysAdmin || makePermissionSetFromRole(context.retiring.globalRole).includesName(Permission.sysadmin)) {
        return [];
    }
    const users = await context.db.user.findMany({ where: { isDeleted: false, isSysAdmin: false, mergedIntoUserId: null }, select: mergeCandidateSelect, orderBy: { id: "asc" } });
    const warnings: string[] = [];
    for (const pair of context.memberships) {
        const bandId = pair.retiring.bandId;
        if (pair.retiring.isDeleted || pair.retiring.band.isDeleted) {
            continue;
        }
        const retiringGrants = userBandGrants(context.retiring, bandId);
        const resultingGrants = new PermissionSet([...makePermissionSetFromRole(context.main.globalRole).names, ...membershipGrants(pair.main ?? undefined)]);
        const lost = gPermissionOrdered.filter(permission => getPermissionDefinition(permission).scope === "band"
            && gContinuitySensitivePermissions.has(permission) && retiringGrants.includesName(permission) && !resultingGrants.includesName(permission)
            && !users.some(user => user.id !== context.retiringUserId && user.id !== context.mainUserId
                && !makePermissionSetFromRole(user.globalRole).includesName(Permission.sysadmin) && userBandGrants(user, bandId).includesName(permission)));
        if (lost.length) {
            warnings.push("Band " + pair.retiring.band.publicId + " loses its last ordinary account holder of: " + lost.join(", ") + ". Main retains its own privileges.");
        }
    }
    return warnings;
}
