import { countEffect, participantWhere, type MergePolicy } from "../types";

export const userTagsPolicy: MergePolicy = {
    key: "userTags",
    userRelations: ["UserTagAssignment.userId"],
    async prepare(context) {
        const tags = await context.db.userTagAssignment.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
        const mainTags = new Set(tags.filter(tag => tag.userId === context.mainUserId).map(tag => tag.userTagId));
        const retiringTags = tags.filter(tag => tag.userId === context.retiringUserId);
        return {
            reviewState: tags,
            report: {
                key: "userTags", title: "Group memberships",
                policy: "Keep only Main's user tags. These memberships affect invitations and expected attendance.",
                effects: [
                    countEffect("Memberships present only on Retiring discarded", retiringTags.filter(tag => !mainTags.has(tag.userTagId)).length),
                    countEffect("Shared memberships retained on Main", retiringTags.filter(tag => mainTags.has(tag.userTagId)).length),
                ],
            },
            async apply(db) {
                await db.userTagAssignment.deleteMany({
                    where: { userId: context.retiringUserId }
                });
            },
        };
    },
};
