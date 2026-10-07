// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/publicResponse.ts:1-22
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: d0b5ee26cf218e981bcaeccd9cdc87904eeca587243e98768d437ecd42ef7fd1
// MIGRATION_REFERENCE_BEGIN
// import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
//
// export class UserMergeError extends Error {
//     name = "UserMergeError";
// }
//
// // Database errors can contain query arguments, including credential hashes or
// // response contents. Never serialize those errors through the merge endpoints.
// export async function publicMergeResponse<T>(operation: () => Promise<T>): Promise<T> {
//     try {
//         return await operation();
//     }
//     catch (error) {
//         if (error instanceof AuthenticationError || error instanceof AuthorizationError
//             || error instanceof NotFoundError || error instanceof UserMergeError)//
//         {
//             // rethrow for certain known errors
//             throw error;
//         }
//         throw new UserMergeError("Unable to complete this merge request. Refresh the report and try again.");
//     }
// }
// MIGRATION_REFERENCE_END
