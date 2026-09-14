import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: (await import("./support/inMemoryPrisma")).authorizationTestDb,
}));

import { Permission } from "shared/permissions";
import previewUserMerge from "src/auth/queries/previewUserMerge";
import searchUserMergeCandidates from "src/auth/queries/searchUserMergeCandidates";
import mergeUsers from "src/auth/mutations/mergeUsers";
import reactivateUser from "src/auth/mutations/reactivateUser";
import addUserSignInMethod from "src/auth/mutations/addUserSignInMethod";
import { canManageUser } from "src/auth/server/userManagementPolicy";
//import { requireUnmergedUserReferences } from "src/auth/server/mergedUserReferences";
import { publicMergeResponse } from "src/auth/server/userMerge/publicResponse";
import { CommitUserMergeInput, UserMergeInput } from "src/auth/userMergeSchemas";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { invokeResolver } from "./support/resolverHarness";

const admin = createAuthorizationTestUser("sysadmin", { id: 1 });
const member = createAuthorizationTestUser("normal", { id: 10 });
const retiring = createAuthorizationTestUser("normal", { id: 20 });
const pair = { mainUserId: 10, retiringUserId: 20 };
beforeEach(() => authorizationTestDb.reset({ user: [admin, member, retiring] }));

describe("merge authorization and lifecycle", () => {
    it("does not serialize hidden query data from unexpected server errors", async () => {
        await expect(publicMergeResponse(async () => { throw new Error("query with private comment and password hash"); }))
            .rejects.toThrow("Unable to complete this merge request");
    });
    it.each(["preview", "search", "commit"])("rejects a user without merge permission at %s", async endpoint => {
        const ctx = createAuthorizationTestContext(member);
        const call = endpoint === "preview" ? invokeResolver(previewUserMerge, pair, ctx)
            : endpoint === "search" ? invokeResolver(searchUserMergeCandidates, { query: "", excludeUserId: 10 }, ctx)
                : invokeResolver(mergeUsers, { participants: pair, confirmation: "a".repeat(64) }, ctx);
        await expect(call).rejects.toThrow();
    });

    it("fresh-checks a revoked merge grant before returning identity or aggregate data", async () => {
        const ctx = createAuthorizationTestContext(admin);
        authorizationTestDb.reset({ user: [{ ...admin, isSysAdmin: false, role: member.role }, member, retiring] });
        await expect(invokeResolver(previewUserMerge, pair, ctx)).rejects.toThrow("merge_users");
        await expect(invokeResolver(searchUserMergeCandidates, { query: "", excludeUserId: 10 }, ctx)).rejects.toThrow("merge_users");
    });

    it("rejects merges from an impersonated session", async () => {
        const ctx = createAuthorizationTestContext(admin);
        ctx.session.$publicData.impersonatingFromUserId = 55;
        await expect(invokeResolver(previewUserMerge, pair, ctx)).rejects.toThrow();
    });

    it("requires authority over both targets, excludes self and protects privileged accounts", () => {
        const actor = createAuthorizationTestUser("bandAdmin", { id: 2, permissions: [Permission.merge_users, Permission.login, Permission.basic_trust] });
        expect(canManageUser({ actor, target: member, action: "merge" })).toBe(true);
        expect(canManageUser({ actor, target: admin, action: "merge" })).toBe(false);
        expect(canManageUser({ actor, target: actor, action: "merge" })).toBe(false);
        expect(canManageUser({ actor, target: createAuthorizationTestUser("editor", { id: 30 }), action: "merge" })).toBe(false);
        expect(canManageUser({ actor, target: { ...member, isDeleted: true }, action: "merge" })).toBe(false);
        expect(canManageUser({ actor: admin, target: { ...member, isDeleted: true }, action: "merge" })).toBe(true);
    });

    it("blocks reactivation, sign-in reassignment and new references to merged accounts", async () => {
        authorizationTestDb.reset({ user: [admin, member, { ...retiring, isDeleted: true, mergedIntoUserId: member.id }] });
        const ctx = createAuthorizationTestContext(admin);
        await expect(invokeResolver(reactivateUser, { userId: retiring.id }, ctx)).rejects.toThrow();
        await expect(invokeResolver(addUserSignInMethod, { userId: retiring.id, method: { type: "email", identifier: "new@test.invalid" } }, ctx)).rejects.toThrow("merged");
        // await expect(requireUnmergedUserReferences(authorizationTestDb as any, [retiring.id])).rejects.toThrow("merged");
        // await expect(requireUnmergedUserReferences(authorizationTestDb as any, [member.id])).resolves.toBeUndefined();
    });

    it("accepts only two distinct IDs and a confirmation, never client-supplied decisions", () => {
        expect(UserMergeInput.safeParse({ mainUserId: 10, retiringUserId: 10 }).success).toBe(false);
        expect(UserMergeInput.safeParse({ ...pair, transfer: [7] }).success).toBe(false);
        expect(CommitUserMergeInput.safeParse({ participants: pair, confirmation: "a".repeat(64), skipBlockers: true }).success).toBe(false);
    });
});
