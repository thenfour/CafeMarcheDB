// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/profile.ts:1-41
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 355b6e7c08e8d2b4731f9d3b3859ba6737a5293e860e15063a18068cb2927175
// MIGRATION_REFERENCE_BEGIN
// import { countEffect, participantWhere, type MergePolicy } from "../types";
//
// export const profilePolicy: MergePolicy = {
//     key: "profile",
//     userRelations: [
//         "UserSetting.userId",
//         "User.mergedIntoUserId",
//         "WikiPage.lockedByUserId",
//     ],
//     async prepare(context) {
//         const settings = await context.db.userSetting.findMany({
//             where: participantWhere(context), orderBy: { id: "asc" },
//         });
//         const priorMerges = await context.db.user.findMany({
//             where: { mergedIntoUserId: context.retiringUserId },
//             select: { id: true }, orderBy: { id: "asc" },
//         });
//         return {
//             reviewState: {
//                 settings,
//                 priorMerges,
//             },
//             report: {
//                 key: "profile",
//                 title: "Profile and preferences",
//                 policy: "Keep Main's identity, name, contact details, role and preferences, including blanks and default preferences. Never combine privileges.",
//                 effects: [
//                     countEffect("Retiring account's stored preferences discarded", settings.filter(setting => setting.userId === context.retiringUserId).length)
//                 ],
//                 consequences: ["The retiring account becomes permanently inactive. Its profile records which account it merged into."],
//                 blockers: [
//                     ...(context.main.isDeleted ? ["Main must be an active account. Swap the accounts or reactivate Main before merging."] : []),
//                     ...(priorMerges.length ? ["Retiring has already received another account merge. This version cannot retire an account with prior merges."] : []),
//                 ],
//             },
//             async apply(db) {
//                 await db.userSetting.deleteMany({ where: { userId: context.retiringUserId } });
//             },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
