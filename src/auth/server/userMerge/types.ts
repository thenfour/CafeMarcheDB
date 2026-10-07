// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/server/userMerge/types.ts:1-41
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 1a6d615760d2df4a6c1eaf5dc90174b78c23e667583b0d492d405f6d4f349ade
// MIGRATION_REFERENCE_BEGIN
// import type { Prisma } from "db";
// import type { MergeReportSection, UserMergeDatabaseParticipants } from "../../userMergeSchemas";
//
//
// // types and utilities shared by merge policies
//
// export type MergeDatabase = Prisma.TransactionClient;
//
// export type MergeUser = Prisma.UserGetPayload<{
//     include: { role: { include: { permissions: { include: { permission: true } } } } }
// }>;
//
// export interface MergeContext extends UserMergeDatabaseParticipants {
//     db: MergeDatabase;
//     main: MergeUser;
//     retiring: MergeUser;
// }
//
// export interface PreparedMergeStep {
//     report: MergeReportSection;
//     // Used only on the server to bind confirmation to the data that was reviewed.
//     reviewState: unknown;
//     apply: (db: MergeDatabase) => Promise<void>;
// }
//
// export interface MergePolicy {
//     key: string;
//     // Every foreign key to User must have an intentional disposition.
//     // and should never be covered by more than one policy.
//     // so this has a unit test ensuring no overlap between policies.
//     userRelations: readonly string[];
//     prepare: (context: MergeContext) => Promise<PreparedMergeStep>;
// }
//
// // pass-through to change shape from "x", y to { label: "x", count: y }
// export const countEffect = (label: string, count: number) => ({ label, count });
//
// // prisma where clause for selecting participants in a user merge
// export const participantWhere = (context: UserMergeDatabaseParticipants) => ({
//     userId: { in: [context.mainUserId, context.retiringUserId] },
// });
// MIGRATION_REFERENCE_END
