import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { UserMergeInput } from "../userMergeSchemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.zod(UserMergeInput),
    resolver.authorize(Permission.login),
    async () => requireRestoredApplicationFeature("accountMerge"),
);


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/queries/previewUserMerge.ts:1-15
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 6989926517b44c6cbbae5b03864cc93a617b7c270ea533f978a89352f84b12c4
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { UserMergeInput } from "../userMergeSchemas";
// import { prepareUserMerge } from "../server/userMerge/prepareUserMerge";
// import { publicMergeResponse } from "../server/userMerge/publicResponse";
//
// export default resolver.pipe(
//     resolver.zod(UserMergeInput),
//     resolver.authorize(Permission.merge_users),
//     async (input, ctx) => publicMergeResponse(() => db.$transaction(async tx => {
//         const { preview } = await prepareUserMerge(tx, ctx, input);
//         return preview;
//     }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 })),
// );
// MIGRATION_REFERENCE_END
