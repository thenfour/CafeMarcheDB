import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

const SearchUserMergeCandidatesInput = z.object({
    query: z.string().trim().max(150),
    excludeUserId: UserPublicIdSchema,
}).strict();

export default resolver.pipe(
    resolver.zod(SearchUserMergeCandidatesInput),
    resolver.authorize(Permission.login),
    async () => requireRestoredApplicationFeature("accountMerge"),
);


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/auth/queries/searchUserMergeCandidates.ts:1-75
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: b873d125900fff9e87fe3e756a93119350ea7ab0a8b2115a33b39ae963464374
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import db from "db";
// import { z } from "zod";
// import { Permission } from "shared/permissions";
// import { SplitQuickFilter } from "shared/quickFilter";
// import { authorizeMergeActor, mergeIdentity } from "../server/userMerge/mergeEligibility";
// import { canManageUser } from "../server/userManagementPolicy";
// import { publicMergeResponse } from "../server/userMerge/publicResponse";
// import { makeUserManagementTarget } from "../server/userManagementState";
// import { UserPublicIdSchema } from "../schemas";
// import { PUBLIC_ID_LENGTH } from "@/shared/publicId";
//
// const schema = z.object({
//     query: z.string().trim().max(150),
//     excludeUserId: UserPublicIdSchema, // the "other" user
// }).strict();
//
// export default resolver.pipe(
//     resolver.zod(schema),
//     resolver.authorize(Permission.merge_users),
//     async ({ query, excludeUserId }, ctx) => publicMergeResponse(async () => {
//         const actor = await authorizeMergeActor(db, ctx);
//
//         // could use resolvePublicId() here; this is slightly handy that it will return
//         // Q: why don't we centralize/reuse quick filter logic? because this has special
//         // logic to allow deleted users, permissions etc that quick filters don't support (yet)
//         const excluded = await db.user.findUnique({ where: { publicId: excludeUserId }, select: { id: true } });
//
//         const users = await db.user.findMany({
//             where: {
//                 id: {
//                     notIn: [actor.principal!.id, excluded?.id ?? actor.principal!.id],
//                 },
//                 mergedIntoUserId: null,
//                 OR: [
//                     // Require every word, allowing names in any order and words across fields.
//                     {
//                         AND: SplitQuickFilter(query).map(word => ({
//                             OR: [
//                                 { name: { contains: word } },
//                                 { email: { contains: word } },
//                             ]
//                         }))
//                     },
//                     ...(query.length === PUBLIC_ID_LENGTH ? [{ publicId: query }] : []),
//                 ],
//             },
//             include:
//             {
//                 role:
//                 {
//                     include:
//                     {
//                         permissions: {
//                             include: { permission: true }
//                         }
//                     }
//                 },
//             },
//             orderBy: [
//                 { name: "asc" },
//                 { id: "asc" },
//             ],
//             take: 100,
//         });
//
//         return users
//             .filter(target => canManageUser({
//                 actor,
//                 target: makeUserManagementTarget(target),
//                 action: "merge",
//             }))
//             .map(mergeIdentity);
//     }),
// );
// MIGRATION_REFERENCE_END
