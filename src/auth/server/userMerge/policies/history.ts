import type { MergePolicy } from "../types";
export const historyPolicy: MergePolicy = {
    key: "history", userRelations: [
        "Action.userId", "Change.userId", "WikiPageRevision.createdByUserId", "Event.updatedByUserId", "Song.updatedByUserId",
        "EventSegmentUserResponse.createdByUserId", "EventSegmentUserResponse.updatedByUserId", "BandUser.createdByUserId", "BandUser.updatedByUserId",
        "Locale.createdByUserId", "Locale.updatedByUserId", "Band.createdByUserId", "Band.updatedByUserId", "BandLocale.createdByUserId", "BandLocale.updatedByUserId",
        "StaticLocalizedStringValue.updatedByUserId", "DynamicLocalizedStringValue.updatedByUserId", "BandStaticLocalizedStringValue.updatedByUserId", "BandDynamicLocalizedStringValue.updatedByUserId",
        "GlobalRolePermission.updatedByUserId", "BandRolePermission.updatedByUserId", "UserSetting.updatedByUserId", "GlobalSetting.updatedByUserId", "BandSetting.updatedByUserId", "BandUserSetting.updatedByUserId",
    ],
    async prepare() {
        return { reviewState: null, report: { key: "history", title: "Historical attribution", policy: "Keep original activity/audit actors, revision authors, editors, membership and localization/settings attribution. The retired profile records its replacement.", effects: [] },
            async apply() { /* Historical attribution deliberately remains on its original actor. */ } };
    },
};
