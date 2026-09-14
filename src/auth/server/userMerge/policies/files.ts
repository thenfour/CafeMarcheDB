import { classifyRecords, recordIds } from "../classifyRecords";
import { countEffect, participantWhere, type MergePolicy } from "../types";

export const filesPolicy: MergePolicy = {
    key: "files",
    userRelations: [
        "File.uploadedByUserId",
        "FileUserTag.userId",
    ],
    async prepare(context) {
        const files = await context.db.file.findMany({ where: { uploadedByUserId: context.retiringUserId }, select: { id: true }, orderBy: { id: "asc" } });
        const tags = await context.db.fileUserTag.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
        const decisions = classifyRecords(tags, context.mainUserId, tag => tag.fileId);
        return {
            reviewState: { files, tags },
            report: {
                key: "files", title: "Files",
                policy: "Transfer uploaded-file ownership and person tags to Main, including deactivated files. Keep one person tag per file.",
                effects: [
                    countEffect("File ownerships transferred", files.length),
                    countEffect("Person tags transferred", decisions.transfer.length),
                    countEffect("Duplicate person tags removed", decisions.remove.length),
                ],
            },
            async apply(db) {
                await db.file.updateMany({ where: { id: { in: recordIds(files) } }, data: { uploadedByUserId: context.mainUserId } });
                await db.fileUserTag.deleteMany({ where: { id: { in: recordIds(decisions.remove) } } });
                await db.fileUserTag.updateMany({ where: { id: { in: recordIds(decisions.transfer) } }, data: { userId: context.mainUserId } });
            },
        };
    },
};
