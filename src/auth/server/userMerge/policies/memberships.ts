import { countEffect, type MergePolicy } from "../types";
export const membershipsPolicy: MergePolicy = {
    key: "memberships", userRelations: ["BandUser.userId", "BandUserSetting.bandUserId"],
    async prepare(context) {
        const overlapping = context.memberships.flatMap(pair => pair.main ? [{ main: pair.main, retiring: pair.retiring }] : []);
        const imported = context.memberships.filter(pair => pair.main === null);
        const settings = await context.db.bandUserSetting.findMany({ where: { bandUserId: { in: overlapping.flatMap(pair => [pair.main.id, pair.retiring.id]) } }, orderBy: { id: "asc" } });
        return { reviewState: { memberships: context.memberships, settings }, report: { key: "memberships", title: { key: "accountMerge.membershipTitle" },
            policy: { key: "accountMerge.membershipPolicy" },
            effects: [countEffect({ key: "accountMerge.sharedMembers" }, overlapping.length), countEffect({ key: "accountMerge.importedMembers" }, imported.length),
                countEffect({ key: "accountMerge.importedRoles" }, imported.filter(pair => pair.retiring.bandRoleId !== null).length),
                countEffect({ key: "accountMerge.discardedPreferences" }, settings.filter(setting => overlapping.some(pair => pair.retiring.id === setting.bandUserId)).length)],
            consequences: [{ key: "accountMerge.membershipConsequence" }] },
            async apply(db) {
                await db.bandUserSetting.deleteMany({ where: { bandUserId: { in: overlapping.map(pair => pair.retiring.id) } } });
                await db.bandUser.updateMany({ where: { id: { in: overlapping.map(pair => pair.retiring.id) } }, data: { isDeleted: true } });
                await db.bandUser.updateMany({ where: { id: { in: imported.map(pair => pair.retiring.id) } }, data: { userId: context.mainUserId, bandRoleId: null } });
            } };
    },
};
