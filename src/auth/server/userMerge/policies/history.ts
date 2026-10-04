import type { MergePolicy } from "../types";

export const historyPolicy: MergePolicy = {
    key: "history",
    userRelations: [
        "Action.userId",
        "Change.userId",
        "WikiPageRevision.createdByUserId",
        "Event.updatedByUserId",
        "EventSegmentUserResponse.createdByUserId",
        "EventSegmentUserResponse.updatedByUserId",
    ],
    async prepare() {
        return {
            reviewState: null,
            report: {
                key: "history",
                title: "Historical attribution",
                policy: "Keep activity-log actors, wiki revision authors and historical editor attribution on their original account. The retired profile records its replacement.",
                effects: [],
            },
            async apply() { /* Historical records intentionally remain unchanged. */ },
        };
    },
};
