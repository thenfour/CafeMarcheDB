import { z } from "zod";
import { UserPublicIdSchema } from "./schemas";

export const UserMergeInput = z.object({
    mainUserId: UserPublicIdSchema,
    retiringUserId: UserPublicIdSchema,
}).strict().refine(input => input.mainUserId !== input.retiringUserId, "Choose two different accounts.");

export const CommitUserMergeInput = z.object({
    participants: UserMergeInput,
    confirmation: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/userMergeSchemas.ts:1-45
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 507d4df11d742a8ea0b1f2ded6630f256cb21af112a4098f7a1af0948dcce2a6
// MIGRATION_REFERENCE_BEGIN
// import { z } from "zod";
// import type { RolePublicId, UserPublicId } from "shared/publicId";
// import { UserPublicIdSchema } from "./schemas";
//
// export const UserMergeInput = z.object({
//     mainUserId: UserPublicIdSchema,
//     retiringUserId: UserPublicIdSchema,
// }).strict().refine(input => input.mainUserId !== input.retiringUserId, "Choose two different accounts.");
//
// export const CommitUserMergeInput = z.object({
//     participants: UserMergeInput,
//     confirmation: z.string().regex(/^[a-f0-9]{64}$/),
// }).strict();
//
// export type UserMergeParticipants = z.infer<typeof UserMergeInput>;
// export type UserMergeDatabaseParticipants = { mainUserId: number; retiringUserId: number };
//
// // This is the entire disclosure contract. Detailed plans never cross the RPC boundary.
// export interface MergeIdentity {
//     publicId: UserPublicId;
//     name: string;
//     email: string;
//     createdAt: Date;
//     roleId: RolePublicId | null;
//     isDeleted: boolean;
//     isSysAdmin: boolean;
// }
//
// export interface MergeReportSection {
//     key: string;
//     title: string;
//     policy: string;
//     effects: { label: string; count: number }[];
//     consequences?: string[];
//     blockers?: string[];
// }
//
// export interface UserMergePreview {
//     policyVersion: number;
//     main: MergeIdentity;
//     retiring: MergeIdentity;
//     sections: MergeReportSection[];
//     canCommit: boolean;
//     confirmation: string;
// }
// MIGRATION_REFERENCE_END
