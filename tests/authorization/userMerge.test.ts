// MIGRATION_DEFERRED_TEST
// Preserved migration reference only. The empty export keeps this file a TypeScript module.
export {};


// MIGRATION_RESTORE: account-merge
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/authorization/userMerge.test.ts:1-145
// Reason: The legacy person-level merge policies have no complete cross-band replacement.
// Restore: Restore candidate search, preview, confirmation, credential/session handling and transactional merging across all owned records and memberships.
// Verification: Adapt policy, picker, authorization and native transaction tests, including stale previews, audit rollback, concurrency and idempotency; exercise the merge dialog.
// SHA256: a8061ff9c51ca57e29f5f40832debe891c302371b34c82787f8c0f29f8556d66
// MIGRATION_REFERENCE_BEGIN
// import { beforeEach, describe, expect, it, vi } from "vitest";
// vi.mock("db", async () => ({
//     ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
//     default: (await import("./support/inMemoryPrisma")).authorizationTestDb,
// }));
//
// import { Permission } from "shared/permissions";
// import mergeUsers from "src/auth/mutations/mergeUsers";
// import previewUserMerge from "src/auth/queries/previewUserMerge";
// import searchUserMergeCandidates from "src/auth/queries/searchUserMergeCandidates";
// import { canManageUser } from "src/auth/server/userManagementPolicy";
// //import { requireUnmergedUserReferences } from "src/auth/server/mergedUserReferences";
// import { publicMergeResponse } from "src/auth/server/userMerge/publicResponse";
// import { CommitUserMergeInput, UserMergeInput } from "src/auth/userMergeSchemas";
// import {
//     asUserManagementActor,
//     asUserManagementTarget,
//     createAuthorizationTestContext,
//     createAuthorizationTestUser,
// } from "./support/authorizationFixtures";
// import { authorizationTestDb } from "./support/inMemoryPrisma";
// import { invokeResolver } from "./support/resolverHarness";
//
// const admin = createAuthorizationTestUser("sysadmin", { id: 1 });
// const member = createAuthorizationTestUser("normal", { id: 10 });
// const retiring = createAuthorizationTestUser("normal", { id: 20 });
// const pair = { mainUserId: member.publicId, retiringUserId: retiring.publicId };
// beforeEach(() => authorizationTestDb.reset({ user: [admin, member, retiring] }));
//
// describe("merge authorization and lifecycle", () => {
//     it("does not serialize hidden query data from unexpected server errors", async () => {
//         await expect(publicMergeResponse(async () => { throw new Error("query with private comment and password hash"); }))
//             .rejects.toThrow("Unable to complete this merge request");
//     });
//     it.each(["preview", "search", "commit"])("rejects a user without merge permission at %s", async endpoint => {
//         const ctx = createAuthorizationTestContext(member);
//         const call = endpoint === "preview" ? invokeResolver(previewUserMerge, pair, ctx)
//             : endpoint === "search" ? invokeResolver(searchUserMergeCandidates, { query: "", excludeUserId: member.publicId }, ctx)
//                 : invokeResolver(mergeUsers, { participants: pair, confirmation: "a".repeat(64) }, ctx);
//         await expect(call).rejects.toThrow();
//     });
//
//     it("fresh-checks a revoked merge grant before returning identity or aggregate data", async () => {
//         const ctx = createAuthorizationTestContext(admin);
//         authorizationTestDb.reset({ user: [{ ...admin, isSysAdmin: false, role: member.role }, member, retiring] });
//         await expect(invokeResolver(previewUserMerge, pair, ctx)).rejects.toThrow("merge_users");
//         await expect(invokeResolver(searchUserMergeCandidates, { query: "", excludeUserId: member.publicId }, ctx)).rejects.toThrow("merge_users");
//     });
//
//     it("loads candidates with public user and role IDs, excluding the actor, profile and merged users", async () => {
//         const merged = createAuthorizationTestUser("normal", { id: 30 });
//         authorizationTestDb.reset({ user: [
//             { ...admin, mergedIntoUserId: null },
//             { ...member, mergedIntoUserId: null },
//             { ...retiring, mergedIntoUserId: null, hashedPassword: "private hash" },
//             { ...merged, mergedIntoUserId: member.id },
//         ] });
//         const candidates = await invokeResolver(searchUserMergeCandidates,
//             { query: "", excludeUserId: member.publicId }, createAuthorizationTestContext(admin));
//         expect(candidates).toEqual([{
//             publicId: retiring.publicId,
//             name: retiring.name,
//             email: retiring.email,
//             createdAt: retiring.createdAt,
//             roleId: retiring.role!.publicId,
//             isDeleted: false,
//             isSysAdmin: false,
//         }]);
//     });
//
//     it.each([retiring.name, retiring.email, retiring.publicId, "no matching account"])("searches merge candidates for %s", async query => {
//         authorizationTestDb.reset({ user: [admin, member, retiring].map(user => ({ ...user, mergedIntoUserId: null })) });
//         const candidates = await invokeResolver(searchUserMergeCandidates,
//             { query, excludeUserId: member.publicId }, createAuthorizationTestContext(admin));
//         expect(candidates.map(candidate => candidate.publicId)).toEqual(query === "no matching account" ? [] : [retiring.publicId]);
//     });
//
//     it.each([
//         ["Lisa", true],
//         ["  SMET   lisa  ", true],
//         ["lisa example.test", true],
//         ["lisa missing", false],
//     ])("matches all search words across name and email for %s", async (query, matches) => {
//         const lisa = { ...retiring, name: "lisa de smet", email: "lisa@example.test" };
//         authorizationTestDb.reset({ user: [admin, member, lisa].map(user => ({ ...user, mergedIntoUserId: null })) });
//         const candidates = await invokeResolver(searchUserMergeCandidates,
//             { query, excludeUserId: member.publicId }, createAuthorizationTestContext(admin));
//         expect(candidates.map(candidate => candidate.publicId)).toEqual(matches ? [lisa.publicId] : []);
//     });
//
//     it("loads candidates without an assigned role", async () => {
//         authorizationTestDb.reset({ user: [
//             { ...admin, mergedIntoUserId: null },
//             { ...member, mergedIntoUserId: null },
//             { ...retiring, roleId: null, role: null, mergedIntoUserId: null },
//         ] });
//         const candidates = await invokeResolver(searchUserMergeCandidates,
//             { query: "", excludeUserId: member.publicId }, createAuthorizationTestContext(admin));
//         expect(candidates).toHaveLength(1);
//         expect(candidates[0]).toMatchObject({ publicId: retiring.publicId, roleId: null });
//     });
//
//     it("rejects merges from an impersonated session", async () => {
//         const ctx = createAuthorizationTestContext(admin);
//         ctx.session.$publicData.impersonatingFromUserId = 55;
//         await expect(invokeResolver(previewUserMerge, pair, ctx)).rejects.toThrow();
//     });
//
//     it("requires authority over both targets, excludes self and protects privileged accounts", () => {
//         const actor = createAuthorizationTestUser("bandAdmin", {
//             id: 2,
//             permissions: [
//                 Permission.login,
//                 Permission.search_users,
//                 Permission.view_users_basic_info,
//                 Permission.merge_users,
//             ],
//         });
//         const managementActor = asUserManagementActor(actor);
//         expect(canManageUser({ actor: managementActor, target: asUserManagementTarget(member), action: "merge" })).toBe(true);
//         expect(canManageUser({ actor: managementActor, target: asUserManagementTarget(admin), action: "merge" })).toBe(false);
//         expect(canManageUser({ actor: managementActor, target: asUserManagementTarget(actor), action: "merge" })).toBe(false);
//         expect(canManageUser({
//             actor: managementActor,
//             target: asUserManagementTarget(createAuthorizationTestUser("editor", { id: 30 })),
//             action: "merge",
//         })).toBe(false);
//         expect(canManageUser({
//             actor: managementActor,
//             target: asUserManagementTarget({ ...member, isDeleted: true }),
//             action: "merge",
//         })).toBe(false);
//         expect(canManageUser({
//             actor: asUserManagementActor(admin),
//             target: asUserManagementTarget({ ...member, isDeleted: true }),
//             action: "merge",
//         })).toBe(true);
//     });
//
//     it("accepts only two distinct IDs and a confirmation, never client-supplied decisions", () => {
//         expect(UserMergeInput.safeParse({ mainUserId: 10, retiringUserId: 10 }).success).toBe(false);
//         expect(UserMergeInput.safeParse({ ...pair, transfer: [7] }).success).toBe(false);
//         expect(CommitUserMergeInput.safeParse({ participants: pair, confirmation: "a".repeat(64), skipBlockers: true }).success).toBe(false);
//     });
// });
// MIGRATION_REFERENCE_END
