import { getUserManagementContinuityWarnings, makePermissionSetFromRole, makeUserManagementTarget } from "../../userManagementState";
import { membershipContinuityWarnings } from "../membershipContinuity";
import { countEffect, participantWhere, type MergeContext, type MergePolicy } from "../types";

async function accountContinuityConsequences(context: MergeContext): Promise<string[]> {
    const lost = await getUserManagementContinuityWarnings(
        context.db, makeUserManagementTarget(context.retiring), makePermissionSetFromRole(context.main.globalRole));
    const globalConsequences = lost.length
        ? ["This merge removes the last ordinary account holder of: " + lost.join(", ") + ". Main retains its global role."]
        : [];
    return [...globalConsequences, ...await membershipContinuityWarnings(context)];
}

export const profilePolicy: MergePolicy = {
    key: "profile",
    userRelations: ["UserSetting.userId", "User.mergedIntoUserId", "WikiPage.lockedByUserId"],
    async prepare(context) {
        const settings = await context.db.userSetting.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
        const priorMerges = await context.db.user.findMany({ where: { mergedIntoUserId: context.retiringUserId }, select: { id: true }, orderBy: { id: "asc" } });
        const locks = await context.db.wikiPage.findMany({ where: { lockedByUserId: context.retiringUserId }, select: { id: true }, orderBy: { id: "asc" } });
        const continuity = await accountContinuityConsequences(context);
        return { reviewState: { settings, priorMerges, locks }, report: { key: "profile", title: "Profile and preferences",
            policy: "Keep Main's identity, name, contact details, global role and account preferences, including blanks and defaults. Never combine privileges.",
            effects: [countEffect("Retiring account's stored preferences discarded", settings.filter(setting => setting.userId === context.retiringUserId).length),
                countEffect("Retiring account's wiki editing locks released", locks.length)],
            consequences: ["The retiring account becomes inactive and records which account it merged into.", ...continuity],
            blockers: [...(context.main.isDeleted ? ["Main must be active. Swap the accounts or reactivate Main before merging."] : []),
                ...(priorMerges.length ? ["Retiring has received prior merges. This version cannot retire it."] : [])] },
            async apply(db) {
                await db.userSetting.deleteMany({ where: { userId: context.retiringUserId } });
                await db.wikiPage.updateMany({ where: { id: { in: locks.map(lock => lock.id) } }, data: { lockedByUserId: null, lockAcquiredAt: null } });
            } };
    },
};
