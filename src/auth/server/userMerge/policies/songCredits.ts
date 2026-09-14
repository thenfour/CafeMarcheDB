import { classifyRecords, recordIds } from "../classifyRecords";
import { countEffect, participantWhere, type MergePolicy } from "../types";

export const songCreditsPolicy: MergePolicy = {
    key: "songCredits",
    userRelations: [
        "SongCredit.userId",
    ],
    async prepare(context) {
        const credits = await context.db.songCredit.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
        const decisions = classifyRecords(
            credits,
            context.mainUserId,
            credit => JSON.stringify([credit.songId, credit.typeId, credit.year, credit.comment])
        );



        return {
            reviewState: credits,
            report: {
                key: "songCredits",
                title: "Song credits",
                policy: "Transfer distinct credits. Remove exact duplicates; different types, years or comments remain distinct.",
                effects: [
                    countEffect("Credits transferred", decisions.transfer.length),
                    countEffect("Exact duplicates removed", decisions.remove.length)],
            },
            async apply(db) {
                await db.songCredit.deleteMany({
                    where: { id: { in: recordIds(decisions.remove) } },
                });
                await db.songCredit.updateMany({
                    where: { id: { in: recordIds(decisions.transfer) } },
                    data: { userId: context.mainUserId },
                });
            },
        };
    },
};
