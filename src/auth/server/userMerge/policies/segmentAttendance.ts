import { generatePublicId } from "src/server/publicId";
import { classifyMembershipRecords, recordIds } from "../classifyRecords";
import { countEffect, membershipWhere, type MergePolicy } from "../types";
export const segmentAttendancePolicy: MergePolicy = {
    key: "segmentAttendance", userRelations: ["EventSegmentUserResponse.bandUserId"],
    async prepare(context) {
        const responses = await context.db.eventSegmentUserResponse.findMany({ where: membershipWhere(context), orderBy: { id: "asc" }, include: { eventSegment: { select: { eventId: true } } } });
        const decisions = classifyMembershipRecords(context, responses, response => response.eventSegmentId);
        const overlaps = decisions.flatMap(plan => plan.overlaps);
        return { reviewState: responses, report: { key: "segmentAttendance", title: "Segment attendance",
            policy: "Transfer missing segment responses within each band. Main's stored attendance wins each overlap, including an unset answer.",
            effects: [countEffect("Segment responses transferred", decisions.reduce((sum, plan) => sum + plan.transfer.length, 0)), countEffect("Overlapping segment responses resolved in favor of Main", overlaps.length),
                countEffect("Different attendance answers discarded", overlaps.filter(({ retained, discarded }) => retained.attendanceId !== discarded.attendanceId).length)] },
            async apply(db) {
                for (const plan of decisions) {
                    const bandUserId = plan.membership.main?.id ?? plan.membership.retiring.id;
                    await db.eventSegmentUserResponse.deleteMany({ where: { id: { in: recordIds(plan.remove) } } });
                    await db.eventSegmentUserResponse.updateMany({ where: { id: { in: recordIds(plan.transfer) } }, data: { bandUserId } });
                    // Calendar sequences include the parent event response revision, even for segment-only answers.
                    for (const eventId of new Set(plan.transfer.map(response => response.eventSegment.eventId))) {
                        await db.eventUserResponse.upsert({ where: { bandUserId_eventId: { bandUserId, eventId } },
                            create: { publicId: generatePublicId(), bandUserId, eventId, revision: 1 }, update: { revision: { increment: 1 } } });
                    }
                }
            } };
    },
};
