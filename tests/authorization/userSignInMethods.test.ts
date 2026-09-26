import { SecurePassword } from "@blitzjs/auth/secure-password";
import { hash256 } from "@blitzjs/auth";
import { beforeAll, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

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
import { xUserSignInMethod } from "src/core/db3/shared/schema/userSignInMethod";
import type { UserSignInMethodPublicId } from "shared/publicId";
import { Prisma } from "db";
import { queryTable } from "src/core/db3/server/db3QueryCore";
import { getRequestAuthorization } from "src/auth/server/requestAuthorization";
import db3Mutation from "./db3MutationTestResolver";

const admin = createAuthorizationTestUser("sysadmin", { id: 1 });
const bandAdmin = createAuthorizationTestUser("bandAdmin", { id: 2 });
const target = createAuthorizationTestUser("normal", { id: 10, email: "contact@test.invalid" });
const other = createAuthorizationTestUser("normal", { id: 11, email: target.email });
const methods = [
    { id: 100, publicId: xUserSignInMethod.parseIdentity("SignInMethod0001"), createdAt: new Date("2026-01-01"), userId: target.id, type: "email", identifier: "first@test.invalid" },
    { id: 101, publicId: xUserSignInMethod.parseIdentity("SignInMethod0002"), createdAt: new Date("2026-01-02"), userId: target.id, type: "email", identifier: "second@test.invalid" },
    { id: 102, publicId: xUserSignInMethod.parseIdentity("SignInMethod0003"), createdAt: new Date("2026-01-03"), userId: target.id, type: "google", identifier: "GoogleSubject123" },
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
        await invokeResolver(deactivateUser, { userId: target.publicId }, adminContext());
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
        expect(authorizationTestDb.snapshot("token")).toEqual([]);
        await expect(authenticateUser(methods[0]!.identifier, validPassword)).rejects.toThrow();
        await expect(resolveGoogleSignIn({ id: methods[2]!.identifier, displayName: "New",
            emails: [{ value: "changed@test.invalid", verified: true }] }, publicContext())).rejects.toThrow();
        await expect(invokeResolver(signup, { email: methods[0]!.identifier, name: "New", password: validPassword }, publicContext()))
            .rejects.toThrow("already assigned");
        expect(authorizationTestDb.snapshot("user")).toHaveLength(4);
        await invokeResolver(reactivateUser, { userId: target.publicId }, adminContext());
        expect((await authenticateUser(methods[1]!.identifier, validPassword)).id).toBe(target.id);
    });

    it("allows fresh signup after explicit release without reclaiming the email on reactivation", async () => {
        await invokeResolver(deactivateUser, { userId: target.publicId }, adminContext());
        await invokeResolver(removeUserSignInMethod, { userId: target.publicId, methodPublicId: methods[0]!.publicId }, adminContext());
        const fresh = await invokeResolver(signup, { email: methods[0]!.identifier, name: "New", password: validPassword }, publicContext());
        expect(authorizationTestDb.snapshot("user").find(row => row.id === fresh.id)?.isDeleted).toBe(false);
        await invokeResolver(reactivateUser, { userId: target.publicId }, adminContext());
        expect((await authenticateUser(methods[0]!.identifier, validPassword)).id).toBe(fresh.id);
        expect((await authenticateUser(methods[1]!.identifier, validPassword)).id).toBe(target.id);
    });
});

describe("Sysadmin sign-in maintenance", () => {
    it.each([null, bandAdmin, target])("rejects unauthorized readers and writers", async actor => {
        const ctx = createAuthorizationTestContext(actor);
        await expect(invokeResolver(getUserSignInMethods, { userId: target.publicId }, ctx)).rejects.toThrow();
        await expect(invokeResolver(addUserSignInMethod, { userId: target.publicId, method: { type: "email", identifier: "new@test.invalid" } }, ctx)).rejects.toThrow();
        await expect(invokeResolver(removeUserSignInMethod, { userId: target.publicId, methodPublicId: methods[0]!.publicId }, ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
    });

    it("rechecks a stale Sysadmin session before exposing identifiers", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: admin.id }, data: { isSysAdmin: false, role: { permissions: [] } } });
        await expect(invokeResolver(getUserSignInMethods, { userId: target.publicId }, adminContext())).rejects.toThrow();
        await expect(invokeResolver(removeUserSignInMethod, { userId: target.publicId, methodPublicId: methods[0]!.publicId }, adminContext())).rejects.toThrow();
    });

    it("accepts a fresh role-carried Sysadmin grant consistently with other maintenance operations", async () => {
        const actor = createAuthorizationTestUser("normal", { id: 30, permissions: [Permission.sysadmin] });
        await authorizationTestDb.getDelegate("user").create({ data: actor });
        await expect(invokeResolver(getUserSignInMethods, { userId: target.publicId }, createAuthorizationTestContext(actor)))
            .resolves.toMatchObject({ hasPassword: true });
    });

    it("lists methods through the admin view without exposing storage IDs or the password hash", async () => {
        await authorizationTestDb.getDelegate("userSignInMethod").create({ data: {
            publicId: xUserSignInMethod.parseIdentity("SignInOther00001"), userId: other.id,
            type: "google", identifier: "OtherUserSubject", createdAt: new Date("2026-01-04"),
        } });
        const result = await invokeResolver(getUserSignInMethods, { userId: target.publicId }, adminContext());
        expect(result.methods).toHaveLength(3);
        expect(result.hasPassword).toBe(true);
        expect(JSON.stringify(result)).not.toContain(hashedPassword);
        expect(result.methods).toEqual(methods.map(({ publicId, type, identifier, createdAt }) => ({ publicId, type, identifier, createdAt })));
        expectTypeOf(result.methods[0]!.publicId).toEqualTypeOf<UserSignInMethodPublicId>();
    });

    it("normalizes an added email, retains contact data, revokes sessions/tokens, and audits without identifiers", async () => {
        const result = await invokeResolver(addUserSignInMethod, { userId: target.publicId, method: { type: "email", identifier: "  Third@Test.Invalid " } }, adminContext());
        expect(result).toEqual({ publicId: expect.any(String) });
        expect(xUserSignInMethod.isIdentity(result.publicId)).toBe(true);
        expectTypeOf(result.publicId).toEqualTypeOf<UserSignInMethodPublicId>();
        expect((await authenticateUser("third@test.invalid", validPassword)).id).toBe(target.id);
        expect(authorizationTestDb.snapshot("user").find(row => row.id === target.id)?.email).toBe(target.email);
        expect(authorizationTestDb.snapshot("session")).toEqual([{ id: 2, userId: admin.id }]);
        expect(authorizationTestDb.snapshot("token")).toEqual([]);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(1);
        expect(JSON.stringify(authorizationTestDb.snapshot("change"))).not.toMatch(/third@|original-password/);
        expect(JSON.stringify(authorizationTestDb.snapshot("change"))).toContain(result.publicId);
        expect(JSON.stringify(authorizationTestDb.snapshot("change"))).not.toContain('"signInMethodId"');
    });

    it("rejects ownership conflicts even when the owner is inactive", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: target.id }, data: { isDeleted: true } });
        await expect(invokeResolver(addUserSignInMethod, { userId: other.publicId, method: { type: "email", identifier: methods[0]!.identifier } }, adminContext()))
            .rejects.toThrow("already assigned");
    });

    it("does not remove another user's method through a forged target ID", async () => {
        await expect(invokeResolver(removeUserSignInMethod, { userId: other.publicId, methodPublicId: methods[0]!.publicId }, adminContext())).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
    });

    it.each([
        { methodId: 100 },
        { methodPublicId: 100 },
        { methodPublicId: "100" },
        { methodPublicId: "~000000000000100" },
        { methodPublicId: methods[0]!.publicId, methodId: 100 },
    ])("rejects legacy, malformed, and mixed removal identities: %j", async identity => {
        const request: unknown = { userId: target.id, ...identity };
        // RPC input is untrusted; these intentionally violate its static contract.
        await expect(invokeResolver(removeUserSignInMethod, request, adminContext())).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
        expect(authorizationTestDb.snapshot("session")).toHaveLength(2);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("gives missing and wrong-owner public identities the same not-found result", async () => {
        const missing = xUserSignInMethod.parseIdentity("SignInMissing001");
        const remove = (userId: typeof target.publicId, methodPublicId: UserSignInMethodPublicId) => (
            invokeResolver(removeUserSignInMethod, { userId, methodPublicId }, adminContext())
        );
        await expect(remove(target.publicId, missing)).rejects.toMatchObject({ name: "NotFoundError" });
        await expect(remove(other.publicId, methods[0]!.publicId)).rejects.toMatchObject({ name: "NotFoundError" });
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
    });

    it("enforces admin authorization on generic DB3 queries too", async () => {
        const query = {
            cmdbQueryContext: "sign-in-method-test",
            table: { tableID: xUserSignInMethod.tableID, tableName: xUserSignInMethod.tableName, viewID: "UserSignInMethod_Admin" },
            filter: { tableParams: { userId: target.publicId } },
            orderBy: undefined,
        };
        const memberAuthorization = await getRequestAuthorization(createAuthorizationTestContext(target).session);
        await expect(queryTable(query, memberAuthorization)).rejects.toThrow("Not authorized");
        const result = await queryTable(query, await getRequestAuthorization(adminContext().session));
        expect(result.items).toHaveLength(3);
        for (const method of result.items) {
            expect(method).not.toHaveProperty("id");
            expect(method).not.toHaveProperty("userId");
        }
    });

    it.each([
        { mutationType: "insert", insertModel: { userId: target.publicId, type: "email", identifier: "bypass@test.invalid" } },
        { mutationType: "update", updatePublicId: methods[0]!.publicId, updateModel: { identifier: "bypass@test.invalid" } },
        { mutationType: "delete", deletePublicId: methods[0]!.publicId, deleteType: "hard" },
    ])("prevents generic maintenance bypass even for Sysadmins: $mutationType", async operation => {
        await expect(invokeResolver(db3Mutation, {
            tableID: xUserSignInMethod.tableID, tableName: xUserSignInMethod.tableName, ...operation,
        }, adminContext())).rejects.toThrow("Not authorized");
        expect(authorizationTestDb.snapshot("userSignInMethod")).toEqual(methods);
    });

    it("retries a public-ID collision without misreporting credential ownership", async () => {
        const create = vi.spyOn(authorizationTestDb.getDelegate("userSignInMethod"), "create")
            .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("collision", {
                code: "P2002", clientVersion: Prisma.prismaVersion.client,
                meta: { target: "UserSignInMethod_publicId_key" },
            }));
        try {
            const result = await invokeResolver(addUserSignInMethod, {
                userId: target.publicId, method: { type: "google", identifier: "NewSubject" },
            }, adminContext());
            expect(create).toHaveBeenCalledTimes(2);
            expect(authorizationTestDb.snapshot("userSignInMethod")).toContainEqual(expect.objectContaining({ publicId: result.publicId }));
        } finally {
            create.mockRestore();
        }
    });

    it("does not retry a raced credential-ownership conflict", async () => {
        const create = vi.spyOn(authorizationTestDb.getDelegate("userSignInMethod"), "create")
            .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("ownership conflict", {
                code: "P2002", clientVersion: Prisma.prismaVersion.client,
                meta: { target: "UserSignInMethod_type_identifier_key" },
            }));
        try {
            await expect(invokeResolver(addUserSignInMethod, {
                userId: target.publicId, method: { type: "google", identifier: "NewSubject" },
            }, adminContext())).rejects.toThrow("already assigned");
            expect(create).toHaveBeenCalledTimes(1);
            expect(authorizationTestDb.snapshot("change")).toEqual([]);
        } finally {
            create.mockRestore();
        }
    });

    it("preserves the last usable method on active users, accounting for passwordless email aliases", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: target.id }, data: { hashedPassword: null } });
        await expect(invokeResolver(removeUserSignInMethod, { userId: target.publicId, methodPublicId: methods[2]!.publicId }, adminContext())).rejects.toThrow("usable replacement");
        await invokeResolver(deactivateUser, { userId: target.publicId }, adminContext());
        for (const method of methods) {
            const result = await invokeResolver(removeUserSignInMethod, { userId: target.publicId, methodPublicId: method.publicId }, adminContext());
            expect(result).toEqual({ publicId: method.publicId });
        }
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
