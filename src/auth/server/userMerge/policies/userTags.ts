import { countEffect, membershipWhere, type MergePolicy } from "../types";
export const userTagsPolicy: MergePolicy = {
    key: "userTags", userRelations: ["BandUserTagAssignment.bandUserId"],
    async prepare(context) {
        const tags = await context.db.bandUserTagAssignment.findMany({ where: membershipWhere(context), orderBy: { id: "asc" } });
        const overlapping = context.memberships.filter(pair => pair.main !== null);
        const retiringTags = tags.filter(tag => overlapping.some(pair => pair.retiring.id === tag.bandUserId));
        const isShared = (tag: typeof retiringTags[number]) => {
            const pair = overlapping.find(pair => pair.retiring.id === tag.bandUserId)!;
            return tags.some(mainTag => mainTag.bandUserId === pair.main?.id && mainTag.bandUserTagId === tag.bandUserTagId);
        };
        return { reviewState: tags, report: { key: "userTags", title: "Group memberships",
            policy: "Keep Main's tags in shared bands; discard Retiring-only tags there. Imported band memberships retain their own tags. Tags affect invitations and expected attendance.",
            effects: [countEffect("Memberships present only on Retiring discarded", retiringTags.filter(tag => !isShared(tag)).length), countEffect("Shared memberships retained on Main", retiringTags.filter(isShared).length)] },
            async apply(db) {
                await db.bandUserTagAssignment.deleteMany({ where: { bandUserId: { in: overlapping.map(pair => pair.retiring.id) } } });
            } };
    },
};
