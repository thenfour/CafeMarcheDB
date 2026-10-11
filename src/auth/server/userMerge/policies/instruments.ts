import { classifyMembershipRecords, recordIds } from "../classifyRecords";
import { countEffect, membershipWhere, type MergePolicy } from "../types";
export const instrumentsPolicy: MergePolicy = {
    key: "instruments", userRelations: ["BandUserInstrument.bandUserId"],
    async prepare(context) {
        const instruments = await context.db.bandUserInstrument.findMany({ where: membershipWhere(context), orderBy: { id: "asc" } });
        const decisions = classifyMembershipRecords(context, instruments, instrument => instrument.bandInstrumentId);
        const invalidMain = context.main.bandUsersByUser.some(member => instruments.filter(instrument => instrument.bandUserId === member.id && instrument.isPrimary).length > 1);
        return { reviewState: instruments, report: { key: "instruments", title: "Instruments", policy: "Union instruments in shared bands, keeping Main's default. Retiring-only memberships retain their instrument selection.",
            effects: [countEffect("Instruments added", decisions.reduce((sum, plan) => sum + plan.transfer.length, 0)), countEffect("Duplicate instrument associations removed", decisions.reduce((sum, plan) => sum + plan.remove.length, 0))],
            blockers: invalidMain ? ["Main has multiple primary instruments in a band. Correct its instrument list before merging."] : [] },
            async apply(db) {
                for (const plan of decisions) {
                    await db.bandUserInstrument.deleteMany({ where: { id: { in: recordIds(plan.remove) } } });
                    if (plan.membership.main) {
                        await db.bandUserInstrument.updateMany({ where: { id: { in: recordIds(plan.transfer) } }, data: { bandUserId: plan.membership.main.id, isPrimary: false } });
                    }
                }
            } };
    },
};
