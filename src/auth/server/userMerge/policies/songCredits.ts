// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/songCredits.ts:1-40
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: efaa3443a8fbd7e545a1d618c3f17bec29dc0f7b7a7a16f109123f17e5f816a5
// MIGRATION_REFERENCE_BEGIN
// import { classifyRecords, recordIds } from "../classifyRecords";
// import { countEffect, participantWhere, type MergePolicy } from "../types";
//
// export const songCreditsPolicy: MergePolicy = {
//     key: "songCredits",
//     userRelations: [
//         "SongCredit.userId",
//     ],
//     async prepare(context) {
//         const credits = await context.db.songCredit.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
//         const decisions = classifyRecords(
//             credits,
//             context.mainUserId,
//             credit => JSON.stringify([credit.songId, credit.typeId, credit.year, credit.comment])
//         );
//
//
//
//         return {
//             reviewState: credits,
//             report: {
//                 key: "songCredits",
//                 title: "Song credits",
//                 policy: "Transfer distinct credits. Remove exact duplicates; different types, years or comments remain distinct.",
//                 effects: [
//                     countEffect("Credits transferred", decisions.transfer.length),
//                     countEffect("Exact duplicates removed", decisions.remove.length)],
//             },
//             async apply(db) {
//                 await db.songCredit.deleteMany({
//                     where: { id: { in: recordIds(decisions.remove) } },
//                 });
//                 await db.songCredit.updateMany({
//                     where: { id: { in: recordIds(decisions.transfer) } },
//                     data: { userId: context.mainUserId },
//                 });
//             },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
