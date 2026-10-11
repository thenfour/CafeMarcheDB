import { classifyMembershipRecords, recordIds } from "../classifyRecords";
import { countEffect, membershipWhere, type MergePolicy } from "../types";
export const eventResponsesPolicy: MergePolicy = {
    key: "eventResponses", userRelations: ["EventUserResponse.bandUserId"],
    async prepare(context) {
        const responses = await context.db.eventUserResponse.findMany({ where: membershipWhere(context), orderBy: { id: "asc" } });
        const decisions = classifyMembershipRecords(context, responses, response => response.eventId);
        const overlaps = decisions.flatMap(plan => plan.overlaps);
        return { reviewState: responses, report: { key: "eventResponses", title: "Event responses",
            policy: "Transfer missing responses within each band. Main's entire stored response wins overlaps, including blank comments and unset values.",
            effects: [countEffect("Responses transferred", decisions.reduce((sum, plan) => sum + plan.transfer.length, 0)), countEffect("Overlapping responses resolved in favor of Main", overlaps.length),
                countEffect("Overlapping responses with different values", overlaps.filter(({ retained, discarded }) => retained.userComment !== discarded.userComment || retained.bandInstrumentId !== discarded.bandInstrumentId || retained.isInvited !== discarded.isInvited).length),
                countEffect("Different non-empty comments discarded", overlaps.filter(({ retained, discarded }) => !!discarded.userComment && discarded.userComment !== retained.userComment).length)] },
            async apply(db) {
                for (const plan of decisions) {
                    await db.eventUserResponse.deleteMany({ where: { id: { in: recordIds(plan.remove) } } });
                    await db.eventUserResponse.updateMany({ where: { id: { in: recordIds(plan.transfer) } }, data: {
                        bandUserId: plan.membership.main?.id ?? plan.membership.retiring.id, revision: { increment: 1 },
                    } });
                }
            } };
    },
};
