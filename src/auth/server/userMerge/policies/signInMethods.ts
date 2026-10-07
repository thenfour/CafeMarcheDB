// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/policies/signInMethods.ts:1-68
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: f7279f269a1b1b7fd495d722b7132684e2d86b58765bbfe83cf67ea5dd697610
// MIGRATION_REFERENCE_BEGIN
// import { countEffect, participantWhere, type MergeContext, type MergeDatabase, type MergePolicy } from "../types";
//
// async function revokeMergedSignInState(db: MergeDatabase, context: MergeContext) {
//     // Impersonation sessions belong to the impersonated user in Session.userId.
//     // Revoke sessions started by either merged identity as well as their own.
//     const sessions = await db.session.findMany({ select: { id: true, publicData: true } });
//     const impersonationIds = sessions.filter(session => {
//         try {
//             const origin = JSON.parse(session.publicData || "null")?.impersonatingFromUserId;
//             return origin === context.mainUserId || origin === context.retiringUserId;
//         } catch { return false; }
//     }).map(session => session.id);
//     await db.session.deleteMany({ where: { OR: [participantWhere(context), { id: { in: impersonationIds } }] } });
//     await db.token.deleteMany({ where: participantWhere(context) });
// }
//
// export const signInMethodsPolicy: MergePolicy = {
//     key: "signInMethods",
//     userRelations: [
//         "UserSignInMethod.userId",
//         "Session.userId",
//         "Token.userId",
//     ],
//     async prepare(context) {
//         const methods = await context.db.userSignInMethod.findMany({ where: participantWhere(context), orderBy: { id: "asc" } });
//         const transferred = methods.filter(method => method.userId === context.retiringUserId);
//         const password = context.main.hashedPassword || context.retiring.hashedPassword;
//         const hasUsableMethod = methods.some(method => method.type === "google" || (method.type === "email" && !!password));
//
//         const passwordDescription = context.main.hashedPassword ? "All email aliases will use Main's existing password."
//             : context.retiring.hashedPassword ? "All email aliases will use Retiring's existing password."
//                 : "No password is set; sign in using Google.";
//
//         return {
//             reviewState: {
//                 methods,
//                 mainPassword: context.main.hashedPassword,
//                 retiringPassword: context.retiring.hashedPassword,
//             },
//             report: {
//                 key: "signInMethods",
//                 title: "Sign-in and subscriptions",
//                 policy: "Transfer all sign-in methods. Keep Main's password when present; otherwise use Retiring's password.",
//                 effects: [
//                     countEffect("Email aliases transferred", transferred.filter(method => method.type === "email").length),
//                     countEffect("Google identities transferred", transferred.filter(method => method.type === "google").length),
//                 ],
//                 consequences: [
//                     passwordDescription,
//                     "Both accounts will be signed out and all password-reset links invalidated.",
//                     "Main's calendar subscription stays valid. Retiring's subscription stops working.",
//                 ],
//                 blockers: hasUsableMethod ? [] : ["The resulting account has no usable sign-in method."],
//             },
//             async apply(db) {
//                 await db.userSignInMethod.updateMany({
//                     where: { userId: context.retiringUserId },
//                     data: { userId: context.mainUserId }
//                 });
//                 await db.user.update({
//                     where: { id: context.mainUserId },
//                     data: { hashedPassword: password }
//                 });
//                 await revokeMergedSignInState(db, context);
//             },
//         };
//     },
// };
// MIGRATION_REFERENCE_END
