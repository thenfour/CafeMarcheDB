// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/segmentAttendance.ts:1-62
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: b86275b9703e8e87194f7d84eddc90ae68dee1dc283bffa67467dff585d833b7
// MIGRATION_REFERENCE_BEGIN
// import { db3Server } from "@db3/server/db3Server";
// import { xEventUserResponse } from "@db3/shared/schema/event";
// import { classifyRecords, recordIds } from "../classifyRecords";
// import { countEffect, participantWhere, type MergePolicy } from "../types";
//
// export const segmentAttendancePolicy: MergePolicy = {
//     key: "segmentAttendance",
//     userRelations: ["EventSegmentUserResponse.userId"],
//     async prepare(context) {
//         const responses = await context.db.eventSegmentUserResponse.findMany({
//             where: participantWhere(context),
//             orderBy: { id: "asc" },
//             include: { eventSegment: { select: { eventId: true } } },
//         });
//         const decisions = classifyRecords(responses, context.mainUserId, response => response.eventSegmentId);
//         const changedEventIds = [...new Set(decisions.transfer.map(response => response.eventSegment.eventId))];
//
//         return {
//             reviewState: responses,
//             report: {
//                 key: "segmentAttendance",
//                 title: "Segment attendance",
//                 policy: "Transfer missing segment responses. Main's stored attendance wins each overlap, including an unset answer.",
//                 effects: [
//                     countEffect("Segment responses transferred", decisions.transfer.length),
//                     countEffect("Overlapping segment responses resolved in favor of Main", decisions.remove.length),
//                     countEffect("Different attendance answers discarded", decisions.overlaps.filter(({ retained, discarded }) => retained.attendanceId !== discarded.attendanceId).length),
//                 ],
//             },
//             async apply(db) {
//                 await db.eventSegmentUserResponse.deleteMany({ where: { id: { in: recordIds(decisions.remove) } } });
//                 await db.eventSegmentUserResponse.updateMany({ where: { id: { in: recordIds(decisions.transfer) } }, data: { userId: context.mainUserId } });
//                 // Calendar sequence numbers include the event response revision.
//                 for (const eventId of changedEventIds) {
//                     await db3Server.table(xEventUserResponse)
//                         .createWithPublicId(publicId => db.eventUserResponse.upsert({
//                             where: {
//                                 userId_eventId: {
//                                     userId: context.mainUserId,
//                                     eventId
//
//                                 }
//                             },
//                             create: {
//                                 publicId,
//                                 userId: context.mainUserId,
//                                 eventId,
//                                 revision: 1
//
//                             },
//                             update: {
//                                 revision:
//                                 {
//                                     increment: 1
//                                 }
//                             },
//                         }));
//                 }
//             },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
