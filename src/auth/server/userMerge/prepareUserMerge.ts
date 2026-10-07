// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/prepareUserMerge.ts:1-62
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 4fd5629a897b9fd5cf2a244d2da9396a81de22f5caca2d80f65359e8e917db6f
// MIGRATION_REFERENCE_BEGIN
// import { createHmac } from "crypto";
// import type { Ctx } from "@blitzjs/next";
// import type { UserMergeParticipants, UserMergePreview } from "../../userMergeSchemas";
// import {
//     getUserManagementContinuityWarnings,
//     makePermissionSetFromRole,
//     makeUserManagementTarget,
// } from "../userManagementState";
// import { loadMergeContext, mergeIdentity } from "./mergeEligibility";
// import { USER_MERGE_POLICY_VERSION, userMergePolicies } from "./policies";
// import type { MergeDatabase, PreparedMergeStep } from "./types";
//
// function confirmationHash(state: unknown): string {
//     const secret = process.env.SESSION_SECRET_KEY;
//     if (!secret) {
//         throw new Error("Session signing (SESSION_SECRET_KEY) is not configured.");
//     }
//     // HMAC prevents aggregate readers using the digest to guess hidden values.
//     return createHmac("sha256", secret)
//         .update(JSON.stringify(state))
//         .digest("hex");
// }
//
// export async function prepareUserMerge(db: MergeDatabase, ctx: Ctx, participants: UserMergeParticipants) {
//     const context = await loadMergeContext(db, ctx, participants);
//     const steps: PreparedMergeStep[] = [];
//
//     for (const policy of userMergePolicies) {
//         steps.push(await policy.prepare(context));
//     }
//
//     // merging can result in continuity issues (e.g., losing the last ordinary account holder of certain capabilities)
//     const lostCapabilities = await getUserManagementContinuityWarnings(
//         db,
//         makeUserManagementTarget(context.retiring),
//         makePermissionSetFromRole(context.main.role)
//     );
//     if (lostCapabilities.length) {
//         steps[0]!.report.consequences!.push(`This merge removes the last ordinary account holder of: ${lostCapabilities.join(", ")}. Main retains its current role.`);
//     }
//
//     const sections = steps.map(step => step.report);
//
//     const confirmation = confirmationHash({
//         version: USER_MERGE_POLICY_VERSION,
//         actorId: ctx.session.userId,
//         participants,
//         main: context.main,
//         retiring: context.retiring,
//         sections,
//         states: steps.map(step => step.reviewState),
//     });
//
//     const preview: UserMergePreview = {
//         policyVersion: USER_MERGE_POLICY_VERSION,
//         main: mergeIdentity(context.main),
//         retiring: mergeIdentity(context.retiring),
//         sections, confirmation,
//         canCommit: sections.every(section => !section.blockers?.length),
//     };
//     return { context, steps, preview };
// }
// MIGRATION_REFERENCE_END
