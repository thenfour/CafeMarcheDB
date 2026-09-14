import { classifyRecords, recordIds } from "../classifyRecords";
import { countEffect, participantWhere, type MergePolicy } from "../types";

export const instrumentsPolicy: MergePolicy = {
    key: "instruments",
    userRelations: ["UserInstrument.userId"],
    async prepare(context) {
        const instruments = await context.db.userInstrument.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
        const main = instruments.filter(instrument => instrument.userId === context.mainUserId);
        const decisions = classifyRecords(instruments, context.mainUserId, instrument => instrument.instrumentId);
        const invalidMain = main.filter(instrument => instrument.isPrimary).length > 1
            || new Set(main.map(instrument => instrument.instrumentId)).size !== main.length;
        return {
            reviewState: instruments,
            report: {
                key: "instruments",
                title: "Instruments",
                policy: "Union instruments. Keep Main's default instrument.",
                effects: [
                    countEffect("Instruments added", decisions.transfer.length),
                    countEffect("Duplicate instrument associations removed", decisions.remove.length),
                ],
                blockers: invalidMain ? ["Main has duplicate instruments or multiple primary instruments. Correct its instrument list before merging."] : [],
            },
            async apply(db) {
                await db.userInstrument.deleteMany({
                    where: { id: { in: recordIds(decisions.remove) } },
                });
                await db.userInstrument.updateMany({
                    where: { id: { in: recordIds(decisions.transfer) } },
                    data: { userId: context.mainUserId, isPrimary: false },
                });
            },
        };
    },
};
