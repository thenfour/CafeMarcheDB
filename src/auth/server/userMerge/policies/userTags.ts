// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/userTags.ts:1-27
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 99d820cceaea53b504a0b65f25b99122acac15e19e92b754346c550bfe3e6f08
// MIGRATION_REFERENCE_BEGIN
// import { countEffect, participantWhere, type MergePolicy } from "../types";
//
// export const userTagsPolicy: MergePolicy = {
//     key: "userTags",
//     userRelations: ["UserTagAssignment.userId"],
//     async prepare(context) {
//         const tags = await context.db.userTagAssignment.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
//         const mainTags = new Set(tags.filter(tag => tag.userId === context.mainUserId).map(tag => tag.userTagId));
//         const retiringTags = tags.filter(tag => tag.userId === context.retiringUserId);
//         return {
//             reviewState: tags,
//             report: {
//                 key: "userTags", title: "Group memberships",
//                 policy: "Keep only Main's user tags. These memberships affect invitations and expected attendance.",
//                 effects: [
//                     countEffect("Memberships present only on Retiring discarded", retiringTags.filter(tag => !mainTags.has(tag.userTagId)).length),
//                     countEffect("Shared memberships retained on Main", retiringTags.filter(tag => mainTags.has(tag.userTagId)).length),
//                 ],
//             },
//             async apply(db) {
//                 await db.userTagAssignment.deleteMany({
//                     where: { userId: context.retiringUserId }
//                 });
//             },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
