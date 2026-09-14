import { SecurePassword } from "@blitzjs/auth/secure-password";
import { hash256 } from "@blitzjs/auth";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: (await import("./support/inMemoryPrisma")).authorizationTestDb,
}));

import { authenticateUser } from "src/auth/mutations/login";
import signup from "src/auth/mutations/signup";
import deactivateUser from "src/auth/mutations/deactivateUser";
import reactivateUser from "src/auth/mutations/reactivateUser";
import addUserSignInMethod from "src/auth/mutations/addUserSignInMethod";
import removeUserSignInMethod from "src/auth/mutations/removeUserSignInMethod";
import getUserSignInMethods from "src/auth/queries/getUserSignInMethods";
import forgotPassword from "src/auth/mutations/forgotPassword";
import resetPassword from "src/auth/mutations/resetPassword";
import { resolveGoogleSignIn } from "src/auth/server/googleSignIn";
import { SignInMethodSchema } from "src/auth/signInMethodSchemas";
import { Permission } from "shared/permissions";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const admin = createAuthorizationTestUser("sysadmin", { id: 1 });
const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 });
const target = createAuthorizationTestUser("normal", { id: 10, email: "contact@test.invalid" });
const other = createAuthorizationTestUser("normal", { id: 11, email: target.email });
const methods = [
    { id: 100, userId: target.id, type: "email", identifier: "first@test.invalid" },
    { id: 101, userId: target.id, type: "email", identifier: "second@test.invalid" },
    { id: 102, userId: target.id, type: "google", identifier: "GoogleSubject123" },
];
const adminContext = () => createAuthorizationTestContext(admin);
const publicContext = () => createAuthorizationTestContext(null);
const validPassword = "original-password";
let hashedPassword: string;

beforeAll(async () => { hashedPassword = await SecurePassword.hash(validPassword); });
beforeEach(() => {
    authorizationTestDb.reset({
        user: [admin, bandAdmin, { ...target, hashedPassword }, { ...other, hashedPassword }],
        userSignInMethod: methods,
        session: [{ id: 1, userId: target.id }, { id: 2, userId: admin.id }],
        token: [{ id: 1, userId: target.id, type: "RESET_PASSWORD" }],
        role: [{ id: 50, isRoleForNewUsers: true }],
    });
});

describe("multiple sign-in resolution", () => {
    it.each(["first@test.invalid", "  SECOND@Test.Invalid  "])("uses the shared password through %s", async email => {
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        expect((await authenticateUser(email, validPassword)).id).toBe(target.id);
        expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ hashedPassword: true }) }));
        await expect(authenticateUser(email, "wrong-password")).rejects.toThrow();
    });

    it("does not authenticate by a matching contact address", async () => {
        await expect(authenticateUser(target.email, validPassword)).rejects.toThrow();
    });

    it("recognizes an established Google subject without requiring an unchanged or verified email", async () => {
        const result = await resolveGoogleSignIn({ id: methods[2]!.identifier, displayName: "Changed" }, publicContext());
        expect(result).toMatchObject({ user: { id: target.id }, created: false });
    });

    it("does not auto-link an unknown Google subject through a reserved email", async () => {
        await expect(resolveGoogleSignIn({ id: "new-subject", displayName: "New",
            emails: [{ value: methods[0]!.identifier, verified: true }] }, publicContext())).rejects.toThrow("already assigned");
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
        expect(authorizationTestDb.snapshot("user")).toHaveLength(4);
    });

    it("creates email and subject ownership together for a new Google signup", async () => {
        const result = await resolveGoogleSignIn({ id: "new-subject", displayName: "New",
            emails: [{ value: "new@test.invalid", verified: true }] }, publicContext());
        expect(result.created).toBe(true);
        expect(authorizationTestDb.snapshot("userSignInMethod").filter(row => row.userId === result.user.id))
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ type: "email", identifier: "new@test.invalid" }),
                expect.objectContaining({ type: "google", identifier: "new-subject" }),
            ]));
    });

    it("requires a verified address for a new Google signup", async () => {
        await expect(resolveGoogleSignIn({ id: "new-subject", displayName: "New",
            emails: [{ value: "new@test.invalid", verified: false }] }, publicContext())).rejects.toThrow();
        expect(authorizationTestDb.snapshot("user")).toHaveLength(4);
    });

    it("preserves reservations on deactivation and restores access through the same methods", async () => {
        await invokeResolver(deactivateUser, { userId: target.id }, adminContext());
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
        expect(authorizationTestDb.snapshot("token")).toEqual([]);
        await expect(authenticateUser(methods[0]!.identifier, validPassword)).rejects.toThrow();
        await expect(resolveGoogleSignIn({ id: methods[2]!.identifier, displayName: "New",
            emails: [{ value: "changed@test.invalid", verified: true }] }, publicContext())).rejects.toThrow();
        await expect(invokeResolver(signup, { email: methods[0]!.identifier, name: "New", password: validPassword }, publicContext()))
            .rejects.toThrow("already assigned");
        expect(authorizationTestDb.snapshot("user")).toHaveLength(4);
        await invokeResolver(reactivateUser, { userId: target.id }, adminContext());
        expect((await authenticateUser(methods[1]!.identifier, validPassword)).id).toBe(target.id);
    });

    it("allows fresh signup after explicit release without reclaiming the email on reactivation", async () => {
        await invokeResolver(deactivateUser, { userId: target.id }, adminContext());
        await invokeResolver(removeUserSignInMethod, { userId: target.id, methodId: 100 }, adminContext());
        const fresh = await invokeResolver(signup, { email: methods[0]!.identifier, name: "New", password: validPassword }, publicContext());
        expect(authorizationTestDb.snapshot("user").find(row => row.id === fresh.id)?.isDeleted).toBe(false);
        await invokeResolver(reactivateUser, { userId: target.id }, adminContext());
        expect((await authenticateUser(methods[0]!.identifier, validPassword)).id).toBe(fresh.id);
        expect((await authenticateUser(methods[1]!.identifier, validPassword)).id).toBe(target.id);
    });
});

describe("Sysadmin sign-in maintenance", () => {
    it.each([null, bandAdmin, target])("rejects unauthorized readers and writers", async actor => {
        const ctx = createAuthorizationTestContext(actor);
        await expect(invokeResolver(getUserSignInMethods, { userId: target.id }, ctx)).rejects.toThrow();
        await expect(invokeResolver(addUserSignInMethod, { userId: target.id, method: { type: "email", identifier: "new@test.invalid" } }, ctx)).rejects.toThrow();
        await expect(invokeResolver(removeUserSignInMethod, { userId: target.id, methodId: 100 }, ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
    });

    it("rechecks a stale Sysadmin session before exposing identifiers", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: admin.id }, data: { isSysAdmin: false, role: { permissions: [] } } });
        await expect(invokeResolver(getUserSignInMethods, { userId: target.id }, adminContext())).rejects.toThrow();
        await expect(invokeResolver(removeUserSignInMethod, { userId: target.id, methodId: 100 }, adminContext())).rejects.toThrow();
    });

    it("accepts a fresh role-carried Sysadmin grant consistently with other maintenance operations", async () => {
        const actor = createAuthorizationTestUser("normal", { id: 30, permissions: [Permission.sysadmin] });
        await authorizationTestDb.getDelegate("user").create({ data: actor });
        await expect(invokeResolver(getUserSignInMethods, { userId: target.id }, createAuthorizationTestContext(actor)))
            .resolves.toMatchObject({ hasPassword: true });
    });

    it("lists methods without exposing the password hash", async () => {
        const result = await invokeResolver(getUserSignInMethods, { userId: target.id }, adminContext());
        expect(result.methods).toHaveLength(3);
        expect(result.hasPassword).toBe(true);
        expect(JSON.stringify(result)).not.toContain(hashedPassword);
    });

    it("normalizes an added email, retains contact data, revokes sessions/tokens, and audits without identifiers", async () => {
        await invokeResolver(addUserSignInMethod, { userId: target.id, method: { type: "email", identifier: "  Third@Test.Invalid " } }, adminContext());
        expect((await authenticateUser("third@test.invalid", validPassword)).id).toBe(target.id);
        expect(authorizationTestDb.snapshot("user").find(row => row.id === target.id)?.email).toBe(target.email);
        expect(authorizationTestDb.snapshot("session")).toEqual([{ id: 2, userId: admin.id }]);
        expect(authorizationTestDb.snapshot("token")).toEqual([]);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(1);
        expect(JSON.stringify(authorizationTestDb.snapshot("change"))).not.toMatch(/third@|original-password/);
    });

    it("rejects ownership conflicts even when the owner is inactive", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: target.id }, data: { isDeleted: true } });
        await expect(invokeResolver(addUserSignInMethod, { userId: other.id, method: { type: "email", identifier: methods[0]!.identifier } }, adminContext()))
            .rejects.toThrow("already assigned");
    });

    it("does not remove another user's method through a forged target ID", async () => {
        await expect(invokeResolver(removeUserSignInMethod, { userId: other.id, methodId: 100 }, adminContext())).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
    });

    it("preserves the last usable method on active users, accounting for passwordless email aliases", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: target.id }, data: { hashedPassword: null } });
        await expect(invokeResolver(removeUserSignInMethod, { userId: target.id, methodId: 102 }, adminContext())).rejects.toThrow("usable replacement");
        await invokeResolver(deactivateUser, { userId: target.id }, adminContext());
        for (const method of methods) await invokeResolver(removeUserSignInMethod, { userId: target.id, methodId: method.id }, adminContext());
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual([]);
    });

    it("validates Google subjects without normalizing case or accepting email addresses", () => {
        expect(SignInMethodSchema.parse({ type: "google", identifier: "SubjectABC" }).identifier).toBe("SubjectABC");
        expect(SignInMethodSchema.safeParse({ type: "google", identifier: "user@gmail.com" }).success).toBe(false);
        expect(SignInMethodSchema.safeParse({ type: "google", identifier: " SubjectABC " }).success).toBe(false);
    });
});

describe("shared password recovery", () => {
    it("resolves an alias to the correct user even when contact emails are shared", async () => {
        const previous = process.env.CMDB_BASE_URL;
        process.env.CMDB_BASE_URL = "https://test.invalid";
        try {
            await invokeResolver(forgotPassword, { email: methods[1]!.identifier }, adminContext());
            expect(authorizationTestDb.snapshot("token")).toHaveLength(1);
            expect(authorizationTestDb.snapshot("token")[0]).toMatchObject({ userId: target.id });
        } finally {
            if (previous === undefined) delete process.env.CMDB_BASE_URL;
            else process.env.CMDB_BASE_URL = previous;
        }
    });

    it("changes the password for both aliases and signs in by user ID rather than contact email", async () => {
        authorizationTestDb.getDelegate("token").reset([{ id: 9, userId: target.id, type: "RESET_PASSWORD", hashedToken: hash256("reset"), expiresAt: new Date("2099-01-01") }]);
        const ctx = publicContext();
        const fields = { token: "reset", password: "replacement-password", passwordConfirmation: "replacement-password" };
        await invokeResolver(resetPassword, fields, ctx);
        expect(ctx.session.userId).toBe(target.id);
        for (const method of methods.slice(0, 2)) {
            expect((await authenticateUser(method.identifier, fields.password)).id).toBe(target.id);
            await expect(authenticateUser(method.identifier, validPassword)).rejects.toThrow();
        }
        await expect(invokeResolver(resetPassword, fields, publicContext())).rejects.toThrow("invalid");
    });

    it("rejects a retained reset token for a deactivated user", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: target.id }, data: { isDeleted: true } });
        authorizationTestDb.getDelegate("token").reset([{ id: 9, userId: target.id, type: "RESET_PASSWORD", hashedToken: hash256("reset"), expiresAt: new Date("2099-01-01") }]);
        await expect(invokeResolver(resetPassword, { token: "reset", password: validPassword, passwordConfirmation: validPassword }, publicContext())).rejects.toThrow("invalid");
        expect(authorizationTestDb.snapshot("user").find(row => row.id === target.id)?.hashedPassword).toBe(hashedPassword);
    });
});
