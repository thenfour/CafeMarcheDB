// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies.ts:1-31
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 8ebc71697df3c88b5fb2b962b4709e62441271f63bb07634643dc74eddadac81
// MIGRATION_REFERENCE_BEGIN
// import { authoredContentPolicy } from "./policies/authoredContent";
// import { eventResponsesPolicy } from "./policies/eventResponses";
// import { filesPolicy } from "./policies/files";
// import { historyPolicy } from "./policies/history";
// import { instrumentsPolicy } from "./policies/instruments";
// import { profilePolicy } from "./policies/profile";
// import { segmentAttendancePolicy } from "./policies/segmentAttendance";
// import { setlistReferencesPolicy } from "./policies/setlistReferences";
// import { signInMethodsPolicy } from "./policies/signInMethods";
// import { songCreditsPolicy } from "./policies/songCredits";
// import { userTagsPolicy } from "./policies/userTags";
// import type { MergePolicy } from "./types";
//
// // Bump when decisions or report meaning changes. Previously reviewed plans expire.
// export const USER_MERGE_POLICY_VERSION = 1;
//
// // Execution order is intentional: segment attendance revises event responses
// // after event-level responses have reached their final owner.
// export const userMergePolicies: readonly MergePolicy[] = [
//     profilePolicy,
//     signInMethodsPolicy,
//     eventResponsesPolicy,
//     segmentAttendancePolicy,
//     songCreditsPolicy,
//     userTagsPolicy,
//     instrumentsPolicy,
//     filesPolicy,
//     authoredContentPolicy,
//     historyPolicy,
//     setlistReferencesPolicy,
// ];
// MIGRATION_REFERENCE_END
