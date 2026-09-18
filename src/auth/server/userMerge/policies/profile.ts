import { countEffect, participantWhere, type MergePolicy } from "../types";

export const profilePolicy: MergePolicy = {
    key: "profile",
    userRelations: [
        "UserSetting.userId",
        "User.mergedIntoUserId",
        "WikiPage.lockedByUserId",
    ],
    async prepare(context) {
        const settings = await context.db.userSetting.findMany({
            where: participantWhere(context), orderBy: { id: "asc" },
        });
        const priorMerges = await context.db.user.findMany({
            where: { mergedIntoUserId: context.retiringUserId },
            select: { id: true }, orderBy: { id: "asc" },
        });
        return {
            reviewState: {
                settings,
                priorMerges,
            },
            report: {
                key: "profile",
                title: "Profile and preferences",
                policy: "Keep Main's identity, name, contact details, role and preferences, including blanks and default preferences. Never combine privileges.",
                effects: [
                    countEffect("Retiring account's stored preferences discarded", settings.filter(setting => setting.userId === context.retiringUserId).length)
                ],
                consequences: ["The retiring account becomes permanently inactive. Its profile records which account it merged into."],
                blockers: [
                    ...(context.main.isDeleted ? ["Main must be an active account. Swap the accounts or reactivate Main before merging."] : []),
                    ...(priorMerges.length ? ["Retiring has already received another account merge. This version cannot retire an account with prior merges."] : []),
                ],
            },
            async apply(db) {
                await db.userSetting.deleteMany({ where: { userId: context.retiringUserId } });
            },
        };
    },
};
