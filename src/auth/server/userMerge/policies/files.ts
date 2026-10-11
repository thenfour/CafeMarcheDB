import { classifyMembershipRecords, recordIds } from "../classifyRecords";
import { countEffect, membershipWhere, type MergePolicy } from "../types";
export const filesPolicy: MergePolicy = {
    key: "files", userRelations: ["File.uploadedByUserId", "FileUserTag.bandUserId"],
    async prepare(context) {
        const files = await context.db.file.findMany({ where: { uploadedByUserId: context.retiringUserId }, select: { id: true }, orderBy: { id: "asc" } });
        const tags = await context.db.fileUserTag.findMany({ where: membershipWhere(context), orderBy: { id: "asc" } });
        const decisions = classifyMembershipRecords(context, tags, tag => tag.fileId);
        return { reviewState: { files, tags }, report: { key: "files", title: "Files",
            policy: "Transfer uploaded-file ownership across all bands, including deactivated files. Merge person tags only within each band, keeping one tag per file.",
            effects: [countEffect("File ownerships transferred", files.length), countEffect("Person tags transferred", decisions.reduce((sum, plan) => sum + plan.transfer.length, 0)), countEffect("Duplicate person tags removed", decisions.reduce((sum, plan) => sum + plan.remove.length, 0))] },
            async apply(db) {
                await db.file.updateMany({ where: { id: { in: recordIds(files) } }, data: { uploadedByUserId: context.mainUserId } });
                for (const plan of decisions) {
                    await db.fileUserTag.deleteMany({ where: { id: { in: recordIds(plan.remove) } } });
                    if (plan.membership.main) {
                        await db.fileUserTag.updateMany({ where: { id: { in: recordIds(plan.transfer) } }, data: { bandUserId: plan.membership.main.id } });
                    }
                }
            } };
    },
};
