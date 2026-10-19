import { describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { publicMergeResponse, UserMergeError } from "src/auth/server/userMerge/publicResponse";
import { canManageUser } from "src/auth/server/userManagementPolicy";
import { CommitUserMergeInput, PreviewUserMergeInput, UserMergeInput, SearchUserMergeCandidatesInput, MergeAccountAnalysisInput } from "src/auth/userMergeSchemas";
import { asUserManagementActor, asUserManagementTarget, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { userPublicId } from "tests/support/userFixtures";

const pair = { mainUserId: userPublicId(10), retiringUserId: userPublicId(20) };
describe("shared-account merge authorization and transport", () => {
    it("redacts unexpected database errors while retaining deliberate public failures", async () => {
        await expect(publicMergeResponse(async () => { throw new Error("query with private comment and password hash"); })).rejects.toThrow("Unable to complete");
        await expect(publicMergeResponse(async () => { throw new UserMergeError("Refresh the report"); })).rejects.toThrow("Refresh the report");
    });
    it("requires account management and merge authority over both targets and excludes self", () => {
        const user = createAuthorizationTestUser("normal", { id: 2, permissions: [Permission.merge_users, Permission.manage_global_users] });
        const actor = asUserManagementActor(user);
        const target = createAuthorizationTestUser("normal", { id: 20, permissions: [] });
        expect(canManageUser({ actor, target: asUserManagementTarget(target), action: "merge" })).toBe(true);
        expect(canManageUser({ actor, target: asUserManagementTarget(user), action: "merge" })).toBe(false);
        expect(canManageUser({ actor, target: asUserManagementTarget({ ...target, isSysAdmin: true }), action: "merge" })).toBe(true);
        expect(canManageUser({ actor, target: asUserManagementTarget(createAuthorizationTestUser("sysadmin", { id: 20 })), action: "merge" })).toBe(false);
        expect(canManageUser({ actor, target: asUserManagementTarget({ ...target, mergedIntoUserId: 10 }), action: "merge" })).toBe(false);
        expect(canManageUser({ actor: asUserManagementActor(createAuthorizationTestUser("bandAdmin", { id: 2 })), target: asUserManagementTarget(target), action: "merge" })).toBe(false);
    });
    it("accepts two distinct public identities and no client-supplied policy decisions", () => {
        expect(UserMergeInput.safeParse(pair).success).toBe(true);
        expect(UserMergeInput.safeParse({ ...pair, retiringUserId: pair.mainUserId }).success).toBe(false);
        expect(UserMergeInput.safeParse({ mainUserId: 10, retiringUserId: 20 }).success).toBe(false);
        expect(CommitUserMergeInput.safeParse({ participants: pair, confirmation: "a".repeat(64) }).success).toBe(true);
        expect(CommitUserMergeInput.safeParse({ participants: pair, confirmation: "a".repeat(64), skipBlockers: true }).success).toBe(false);
    });
    it.each([null, "MergeBand0000001"])("rejects caller band scope %s at every shared-account boundary", bandPublicId => {
        expect(PreviewUserMergeInput.safeParse({ participants: pair, bandPublicId }).success).toBe(false);
        expect(CommitUserMergeInput.safeParse({ participants: pair, confirmation: "a".repeat(64), bandPublicId }).success).toBe(false);
        expect(SearchUserMergeCandidatesInput.safeParse({ query: "", excludeUserId: pair.mainUserId, bandPublicId }).success).toBe(false);
        expect(MergeAccountAnalysisInput.safeParse({ userId: pair.mainUserId, bandPublicId }).success).toBe(false);
    });
});
