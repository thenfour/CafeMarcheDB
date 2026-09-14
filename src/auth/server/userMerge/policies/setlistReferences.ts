import { ZSetlistPlanPayload } from "src/core/db3/shared/setlistPlanTypes";
import { countEffect, type MergePolicy } from "../types";

export const setlistReferencesPolicy: MergePolicy = {
    key: "setlistReferences",
    userRelations: [], // These references live inside SetlistPlan.payloadJson.
    async prepare(context) {
        const plans = await context.db.setlistPlan.findMany({
            select: { id: true, payloadJson: true },
            orderBy: { id: "asc" },
        });
        let invalid = 0;
        const referencingPlans: number[] = [];
        for (const plan of plans) {
            try {
                const payload = ZSetlistPlanPayload.parse(JSON.parse(plan.payloadJson));
                const associations = [
                    ...payload.columns,
                    ...(payload.columnLeds || []),
                    ...(payload.rowLeds || [])
                ]
                    .map(item => item.associatedItem);

                if (associations.some(item => item?.itemType === "user" && item.id === context.retiringUserId)) {
                    referencingPlans.push(plan.id);
                }
            } catch {
                invalid++;
            }
        }
        return {
            reviewState: {
                referencingPlans,
                invalid,
            },
            report: {
                key: "setlistReferences",
                title: "Embedded setlist references",
                policy: "This version requires setlist plans to have no embedded references to Retiring. All stored plans must be readable to establish this.",
                effects: [
                    countEffect("Plans referencing Retiring", referencingPlans.length), countEffect("Unreadable plans", invalid),
                ],
                blockers: [
                    ...(referencingPlans.length ? ["Setlist plans contain user references that this version cannot merge."] : []),
                    ...(invalid ? ["Unreadable setlist plans prevent a complete reference check."] : []),
                ],
            },
            async apply() { /* Unsupported references block the entire operation. */ },
        };
    },
};
