// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/files.ts:1-32
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 39b9fa4ed38a94a3b451f75ab322ff904a8e735e7aaf4345b12e5d3b05504566
// MIGRATION_REFERENCE_BEGIN
// import { classifyRecords, recordIds } from "../classifyRecords";
// import { countEffect, participantWhere, type MergePolicy } from "../types";
//
// export const filesPolicy: MergePolicy = {
//     key: "files",
//     userRelations: [
//         "File.uploadedByUserId",
//         "FileUserTag.userId",
//     ],
//     async prepare(context) {
//         const files = await context.db.file.findMany({ where: { uploadedByUserId: context.retiringUserId }, select: { id: true }, orderBy: { id: "asc" } });
//         const tags = await context.db.fileUserTag.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
//         const decisions = classifyRecords(tags, context.mainUserId, tag => tag.fileId);
//         return {
//             reviewState: { files, tags },
//             report: {
//                 key: "files", title: "Files",
//                 policy: "Transfer uploaded-file ownership and person tags to Main, including deactivated files. Keep one person tag per file.",
//                 effects: [
//                     countEffect("File ownerships transferred", files.length),
//                     countEffect("Person tags transferred", decisions.transfer.length),
//                     countEffect("Duplicate person tags removed", decisions.remove.length),
//                 ],
//             },
//             async apply(db) {
//                 await db.file.updateMany({ where: { id: { in: recordIds(files) } }, data: { uploadedByUserId: context.mainUserId } });
//                 await db.fileUserTag.deleteMany({ where: { id: { in: recordIds(decisions.remove) } } });
//                 await db.fileUserTag.updateMany({ where: { id: { in: recordIds(decisions.transfer) } }, data: { userId: context.mainUserId } });
//             },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
