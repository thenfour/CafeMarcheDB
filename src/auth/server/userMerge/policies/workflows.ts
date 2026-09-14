// also includes wiki stuff

import { countEffect, type MergePolicy } from "../types";

export const workflowsPolicy: MergePolicy = {
    key: "workflows",
    userRelations: [
        "WorkflowDefNodeDefaultAssignee.userId",
        "WorkflowInstanceNodeAssignee.userId",
        "WorkflowInstanceNodeLastAssignee.userId",
        "WikiPage.lockedByUserId",
    ],
    async prepare(context) {
        const where = { userId: context.retiringUserId };
        const defaults = await context.db.workflowDefNodeDefaultAssignee.count({ where });
        const current = await context.db.workflowInstanceNodeAssignee.count({ where });
        const previous = await context.db.workflowInstanceNodeLastAssignee.count({ where });
        const locks = await context.db.wikiPage.findMany({
            where: { lockedByUserId: context.retiringUserId },
            select: { id: true },
            orderBy: { id: "asc" }
        });
        return {
            reviewState: { defaults, current, previous, locks },
            report: {
                key: "workflows",
                title: "Workflow assignments and editing locks",
                policy: "This version requires Retiring to have no workflow assignments. Release Retiring's wiki editing locks.",
                effects: [
                    countEffect("Default workflow assignments", defaults),
                    countEffect("Current workflow assignments", current),
                    countEffect("Previous workflow assignments", previous),
                    countEffect("Wiki editing locks released", locks.length),
                ],
                blockers: defaults + current + previous > 0 ? ["Retiring has workflow assignments that this version cannot merge."] : [],
            },
            async apply(db) {
                await db.wikiPage.updateMany({
                    where: { lockedByUserId: context.retiringUserId },
                    data: { lockedByUserId: null }
                });
            },
        };
    },
};
