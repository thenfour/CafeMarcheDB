import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { CommitUserMergeInput } from "../userMergeSchemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.zod(CommitUserMergeInput),
    resolver.authorize(Permission.login),
    async () => requireRestoredApplicationFeature("accountMerge"),
);


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/mutations/mergeUsers.ts:1-13
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: 9967571e5c9719d3826522471c42b4cf1a149c8ff8d1be9743da6aa8a94f374a
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import db from "db";
// import { Permission } from "shared/permissions";
// import { CommitUserMergeInput } from "../userMergeSchemas";
// import { commitUserMerge } from "../server/userMerge/commitUserMerge";
// import { publicMergeResponse } from "../server/userMerge/publicResponse";
//
// export default resolver.pipe(
//     resolver.zod(CommitUserMergeInput),
//     resolver.authorize(Permission.merge_users),
//     // as any =>  avoid exploding type checking
//     (input, ctx) => publicMergeResponse(() => commitUserMerge(db as any, ctx, input)),
// );
// MIGRATION_REFERENCE_END
