// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/history.ts:1-25
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: bafa2f369ef0b03345b6aa596eed9916ce9cc4fc089367921ad186303ea5a40c
// MIGRATION_REFERENCE_BEGIN
// import type { MergePolicy } from "../types";
//
// export const historyPolicy: MergePolicy = {
//     key: "history",
//     userRelations: [
//         "Action.userId",
//         "Change.userId",
//         "WikiPageRevision.createdByUserId",
//         "Event.updatedByUserId",
//         "EventSegmentUserResponse.createdByUserId",
//         "EventSegmentUserResponse.updatedByUserId",
//     ],
//     async prepare() {
//         return {
//             reviewState: null,
//             report: {
//                 key: "history",
//                 title: "Historical attribution",
//                 policy: "Keep activity-log actors, wiki revision authors and historical editor attribution on their original account. The retired profile records its replacement.",
//                 effects: [],
//             },
//             async apply() { /* Historical records intentionally remain unchanged. */ },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
