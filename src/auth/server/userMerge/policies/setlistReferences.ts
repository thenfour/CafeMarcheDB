// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/setlistReferences.ts:1-51
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: fd822d6cc9498485c0ad82630d49e35a6345a41320e6a2a60498cd797c4939a2
// MIGRATION_REFERENCE_BEGIN
// import { ZSetlistPlanPayload } from "src/core/db3/shared/setlistPlanTypes";
// import { countEffect, type MergePolicy } from "../types";
//
// export const setlistReferencesPolicy: MergePolicy = {
//     key: "setlistReferences",
//     userRelations: [], // These references live inside SetlistPlan.payloadJson.
//     async prepare(context) {
//         const plans = await context.db.setlistPlan.findMany({
//             select: { id: true, payloadJson: true },
//             orderBy: { id: "asc" },
//         });
//         let invalid = 0;
//         const referencingPlans: number[] = [];
//         for (const plan of plans) {
//             try {
//                 const payload = ZSetlistPlanPayload.parse(JSON.parse(plan.payloadJson));
//                 const associations = [
//                     ...payload.columns,
//                     ...(payload.columnLeds || []),
//                     ...(payload.rowLeds || [])
//                 ]
//                     .map(item => item.associatedItem);
//
//                 if (associations.some(item => item?.itemType === "user" && item.id === context.retiring.publicId)) {
//                     referencingPlans.push(plan.id);
//                 }
//             } catch {
//                 invalid++;
//             }
//         }
//         return {
//             reviewState: {
//                 referencingPlans,
//                 invalid,
//             },
//             report: {
//                 key: "setlistReferences",
//                 title: "Embedded setlist references",
//                 policy: "This version requires setlist plans to have no embedded references to Retiring. All stored plans must be readable to establish this.",
//                 effects: [
//                     countEffect("Plans referencing Retiring", referencingPlans.length), countEffect("Unreadable plans", invalid),
//                 ],
//                 blockers: [
//                     ...(referencingPlans.length ? ["Setlist plans contain user references that this version cannot merge."] : []),
//                     ...(invalid ? ["Unreadable setlist plans prevent a complete reference check."] : []),
//                 ],
//             },
//             async apply() { /* Unsupported references block the entire operation. */ },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
