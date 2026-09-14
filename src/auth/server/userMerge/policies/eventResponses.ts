import { classifyRecords, recordIds } from "../classifyRecords";
import { countEffect, participantWhere, type MergePolicy } from "../types";

export const eventResponsesPolicy: MergePolicy = {
    key: "eventResponses",
    userRelations: ["EventUserResponse.userId"],
    async prepare(context) {
        const responses = await context.db.eventUserResponse.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
        const decisions = classifyRecords(responses, context.mainUserId, response => response.eventId);

        const discardedComments = decisions.overlaps.filter(({ retained, discarded }) =>
            !!discarded.userComment && discarded.userComment !== retained.userComment);

        const differentResponses = decisions.overlaps.filter(({ retained, discarded }) =>
            retained.userComment !== discarded.userComment || retained.instrumentId !== discarded.instrumentId || retained.isInvited !== discarded.isInvited);

        return {
            reviewState: responses,
            report: {
                key: "eventResponses",
                title: "Event responses",
                policy: "Transfer missing responses. For each shared event, Main's entire stored response wins, including blank comments and unset values.",
                effects: [
                    countEffect("Responses transferred", decisions.transfer.length),
                    countEffect("Overlapping responses resolved in favor of Main", decisions.remove.length),
                    countEffect("Overlapping responses with different values", differentResponses.length),
                    countEffect("Different non-empty comments discarded", discardedComments.length),
                ],
            },
            async apply(db) {
                await db.eventUserResponse.deleteMany({
                    where: { id: { in: recordIds(decisions.remove) } },
                });
                await db.eventUserResponse.updateMany({
                    where: { id: { in: recordIds(decisions.transfer) } },
                    data: { userId: context.mainUserId, revision: { increment: 1 } },
                });
            },
        };
    },
};
