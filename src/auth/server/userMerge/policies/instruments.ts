// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/instruments.ts:1-36
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: aa93974e51fc44b5d692f72e16561c990acf933e5db16c55a151b7b320d638f7
// MIGRATION_REFERENCE_BEGIN
// import { classifyRecords, recordIds } from "../classifyRecords";
// import { countEffect, participantWhere, type MergePolicy } from "../types";
//
// export const instrumentsPolicy: MergePolicy = {
//     key: "instruments",
//     userRelations: ["UserInstrument.userId"],
//     async prepare(context) {
//         const instruments = await context.db.userInstrument.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
//         const main = instruments.filter(instrument => instrument.userId === context.mainUserId);
//         const decisions = classifyRecords(instruments, context.mainUserId, instrument => instrument.instrumentId);
//         const invalidMain = main.filter(instrument => instrument.isPrimary).length > 1
//             || new Set(main.map(instrument => instrument.instrumentId)).size !== main.length;
//         return {
//             reviewState: instruments,
//             report: {
//                 key: "instruments",
//                 title: "Instruments",
//                 policy: "Union instruments. Keep Main's default instrument.",
//                 effects: [
//                     countEffect("Instruments added", decisions.transfer.length),
//                     countEffect("Duplicate instrument associations removed", decisions.remove.length),
//                 ],
//                 blockers: invalidMain ? ["Main has duplicate instruments or multiple primary instruments. Correct its instrument list before merging."] : [],
//             },
//             async apply(db) {
//                 await db.userInstrument.deleteMany({
//                     where: { id: { in: recordIds(decisions.remove) } },
//                 });
//                 await db.userInstrument.updateMany({
//                     where: { id: { in: recordIds(decisions.transfer) } },
//                     data: { userId: context.mainUserId, isPrimary: false },
//                 });
//             },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
