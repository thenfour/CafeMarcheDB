import type { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gPermissionRegistry, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { createAuthorizationTestContext } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";

// Vitest hoists mock factories; load their dependencies inside the factory.
vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { loadAuthorization, loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { configuredBandScope, platformScope } from "src/auth/server/authorizationContext";
import { assertValidSysadminRole } from "src/auth/server/sessionInvalidation";
import { createPublicDataFromDatabase } from "src/auth/server/effectivePermissions";
import { canManageUser } from "src/auth/server/userManagementPolicy";
import { findSignInUser } from "src/auth/server/signInMethods";
import signup from "src/auth/mutations/signup";
import claimAdminBootstrap from "src/auth/mutations/claimAdminBootstrap";
import { invokeResolver } from "./support/resolverHarness";

// The in-memory delegates implement the standard queries exercised here.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;

const publicId = (prefix: string, id: number): string => `${prefix}${String(id).padStart(16 - prefix.length, "0")}`;
const bandA = { kind: "band", bandPublicId: parsePublicId<"Band">(publicId("Band", 1)) } as const;
const bandB = { kind: "band", bandPublicId: parsePublicId<"Band">(publicId("Band", 2)) } as const;
const account = { id: 42, publicId: publicId("User", 42), name: "Shared person", email: "shared@test.invalid",
    phone: null, createdAt: new Date(), cssClass: null, isDeleted: false, mergedIntoUserId: null,
    globalRoleId: null, isSysAdmin: false };
const permissionId = (name: Permission): number => gPermissionRegistry.findIndex(definition => definition.key === name) + 1;
const bandGrant = (id: number, bandRoleId: number, name: Permission) => ({ id, bandRoleId, permissionId: permissionId(name) });
const globalGrant = (id: number, name: Permission) => ({ id, globalRoleId: 30, permissionId: permissionId(name) });

function resetFixture(): void {
    authorizationTestDb.reset({
        user: [account],
        band: [1, 2].map(id => ({ id, publicId: publicId("Band", id), isDeleted: false })),
        locale: ["en-US", "fr-BE", "nl-BE"].map((ietfTag, index) => ({
            id: index + 1, publicId: publicId("Locale", index + 1), ietfTag, isDeleted: false, sortOrder: index,
        })),
        bandLocale: [1, 2].flatMap(bandId => [1, 2, 3].map(localeId => ({
            id: bandId * 10 + localeId, bandId, localeId, sortOrder: localeId,
        }))),
        bandUser: [
            { id: 1, publicId: publicId("BandUser", 1), userId: 42, bandId: 1, bandRoleId: 20, isDeleted: false },
            { id: 2, publicId: publicId("BandUser", 2), userId: 42, bandId: 2, bandRoleId: 21, isDeleted: false },
        ],
        globalRole: [{ id: 30, isSysAdminRole: true, isDeleted: false }],
        bandRole: [
            { id: 10, isPublicRole: true, isRoleForNewUsers: false, isDeleted: false },
            { id: 20, isPublicRole: false, isRoleForNewUsers: false, isDeleted: false },
            { id: 21, isPublicRole: false, isRoleForNewUsers: false, isDeleted: false },
            { id: 22, isPublicRole: false, isRoleForNewUsers: true, isDeleted: false },
        ],
        permission: gPermissionRegistry.map((definition, index) => ({
            id: index + 1, name: definition.key, isDeleted: false,
        })),
        globalRolePermission: [globalGrant(1, Permission.sysadmin), globalGrant(2, Permission.login),
            globalGrant(3, Permission.manage_global_users), globalGrant(4, Permission.manage_events)],
        bandRolePermission: [bandGrant(1, 10, Permission.public), bandGrant(2, 10, Permission.view_events),
            bandGrant(3, 20, Permission.manage_events), bandGrant(4, 21, Permission.view_songs),
            bandGrant(5, 22, Permission.respond_to_events)],
    }, { includeAuthorizationRoles: false });
}

const sessionForAccount = () => {
    const { session } = createAuthorizationTestContext(null);
    session.$publicData.userId = account.id;
    return session;
};

describe("trusted platform and band authorization", () => {
    beforeEach(() => { vi.stubEnv("CMDB_DEFAULT_BAND_ID", "1"); resetFixture(); });
    afterEach(() => { vi.unstubAllEnvs(); });

    it("uses only the active band's membership and preserves it in authenticated context", async () => {
        const session = sessionForAccount();
        const first = await loadAuthorization(session, bandA);
        const second = await loadAuthorization(session, bandB);
        expect(first.hasPermission(Permission.manage_events)).toBe(true);
        expect(first.hasPermission(Permission.view_songs)).toBe(false);
        expect(second.hasPermission(Permission.view_songs)).toBe(true);
        expect(second.hasPermission(Permission.manage_events)).toBe(false);
        expect(first.requireUser().requireMembership().bandId).toBe(1);
        expect(() => first.requireBandResource(2)).toThrow("another band");
        expect(session.$publicData.authorizationBandPublicId).toBe(bandB.bandPublicId);
        await loadAuthorization(session, bandA);
        expect(session.$publicData.authorizationBandPublicId).toBe(bandA.bandPublicId);
        expect(session.$publicData.permissionNames).not.toContain(Permission.view_songs);
    });

    it("keeps platform context free of membership grants", async () => {
        const auth = await loadAuthorization(sessionForAccount(), platformScope);
        expect(auth.band).toBeNull();
        expect(auth.membership).toBeNull();
        expect(auth.hasPermission(Permission.login)).toBe(true);
        expect(auth.hasPermission(Permission.manage_events)).toBe(false);
        expect(() => auth.requireBand()).toThrow("band context");
    });

    it("loads public band access without promoting an anonymous visitor to membership", async () => {
        const auth = await loadAuthorization(createAuthorizationTestContext(null).session, bandA);
        expect(auth.hasPermission(Permission.view_events)).toBe(true);
        expect(auth.hasPermission(Permission.login)).toBe(false);
        expect(auth.membership).toBeNull();
        expect(() => auth.requireMembership()).toThrow("active user");
    });

    it("does not give outsiders or inactive members the role for new members", async () => {
        await authorizationTestDb.getDelegate("bandUser").deleteMany();
        const outsider = await loadAuthorization(sessionForAccount(), bandA);
        expect(outsider.hasPermission(Permission.respond_to_events)).toBe(false);
        expect(outsider.hasPermission(Permission.manage_events)).toBe(false);
        expect(outsider.hasPermission(Permission.login)).toBe(true);
        expect(() => outsider.requireMembership()).toThrow("active membership");
        await authorizationTestDb.getDelegate("bandUser").create({ data: {
            publicId: publicId("BandUser", 1), bandId: 1, userId: 42, bandRoleId: null, isDeleted: true,
        } });
        const inactive = await loadAuthorization(sessionForAccount(), bandA);
        expect(inactive.hasPermission(Permission.respond_to_events)).toBe(false);
        expect(inactive.membership).toBeNull();
    });

    it("applies the new-member role only to an active roleless membership", async () => {
        await authorizationTestDb.getDelegate("bandUser").update({ where: { id: 1 }, data: { bandRoleId: null } });
        const auth = await loadAuthorization(sessionForAccount(), bandA);
        expect(auth.hasPermission(Permission.respond_to_events)).toBe(true);
        expect(auth.hasPermission(Permission.manage_events)).toBe(false);
    });

    it("never accepts platform permissions or never_grant from a band role", async () => {
        await authorizationTestDb.getDelegate("bandRolePermission").create({ data: bandGrant(100, 20, Permission.sysadmin) });
        await authorizationTestDb.getDelegate("bandRolePermission").create({ data: bandGrant(101, 20, Permission.manage_global_users) });
        await authorizationTestDb.getDelegate("bandRolePermission").create({ data: bandGrant(102, 20, Permission.never_grant) });
        const auth = await loadAuthorization(sessionForAccount(), bandA);
        expect(auth.hasPermission(Permission.sysadmin)).toBe(false);
        expect(auth.hasPermission(Permission.manage_global_users)).toBe(false);
        expect(auth.hasPermission(Permission.never_grant)).toBe(false);
    });

    it.each(["bandRole", "permission"])("excludes deleted %s grants", async table => {
        const id = table === "bandRole" ? 20 : permissionId(Permission.manage_events);
        await authorizationTestDb.getDelegate(table).update({ where: { id }, data: { isDeleted: true } });
        expect((await loadAuthorization(sessionForAccount(), bandA)).hasPermission(Permission.manage_events)).toBe(false);
    });

    it("inherits actual Sysadmin-role grants without turning the flag into a bypass", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { isSysAdmin: true } });
        const first = await loadAuthorization(sessionForAccount(), bandB);
        expect(first.hasPermission(Permission.sysadmin)).toBe(true);
        expect(first.hasPermission(Permission.manage_events)).toBe(true);
        await authorizationTestDb.getDelegate("globalRolePermission").deleteMany({ where: { permissionId: permissionId(Permission.sysadmin) } });
        expect((await loadAuthorization(sessionForAccount(), bandB)).hasPermission(Permission.sysadmin)).toBe(false);
        expect((await loadAuthorization(sessionForAccount(), platformScope)).hasPermission(Permission.manage_events)).toBe(false);
    });

    it("honors an assigned global role without requiring the Sysadmin display flag", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { globalRoleId: 30 } });
        const auth = await loadAuthorization(sessionForAccount(), platformScope);
        expect(auth.user?.isSysAdmin).toBe(false);
        expect(auth.hasPermission(Permission.manage_global_users)).toBe(true);
    });

    it.each(["isDeleted", "mergedIntoUserId"])("revokes inactive shared accounts (%s)", async field => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { [field]: field === "isDeleted" ? true : 99 } });
        const session = sessionForAccount();
        const revoke = vi.spyOn(session, "$revoke");
        const auth = await loadAuthorization(session, bandA);
        expect(revoke).toHaveBeenCalledOnce();
        expect(auth.user).toBeNull();
        expect(auth.hasPermission(Permission.login)).toBe(false);
    });

    it("refreshes membership state while preserving the person's other band and session", async () => {
        const session = sessionForAccount();
        const original = await loadAuthorization(session, bandA);
        await authorizationTestDb.getDelegate("bandUser").update({ where: { id: 1 }, data: { isDeleted: true } });
        expect((await original.refresh(database)).hasPermission(Permission.manage_events)).toBe(false);
        expect((await loadAuthorization(sessionForAccount(), bandB)).hasPermission(Permission.view_songs)).toBe(true);
        const next = sessionForAccount();
        expect((await loadAuthorization(next, bandA)).membership).toBeNull();
        expect(next.userId).toBe(42);
    });

    it("shares concurrent reads within one scope and does not reuse it in a different scope", async () => {
        const session = sessionForAccount();
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        const write = vi.spyOn(session, "$setPublicData");
        const [first, second] = await Promise.all([loadAuthorization(session, bandA), loadAuthorization(session, bandA)]);
        expect(first).toBe(second);
        expect(lookup).toHaveBeenCalledOnce();
        expect(write).toHaveBeenCalledOnce();
        await loadAuthorization(session, bandB);
        expect(lookup).toHaveBeenCalledTimes(2);
    });

    it("does not reuse anonymous grants after login in the same request", async () => {
        const session = createAuthorizationTestContext(null).session;
        await loadAuthorization(session, bandA);
        session.$publicData.userId = 42;
        expect((await loadAuthorization(session, bandA)).hasPermission(Permission.manage_events)).toBe(true);
    });

    it("rejects unavailable bands, invalid configuration, and database errors", async () => {
        await authorizationTestDb.getDelegate("band").update({ where: { id: 2 }, data: { isDeleted: true } });
        await expect(loadAuthorization(sessionForAccount(), bandB)).rejects.toThrow("unavailable");
        vi.stubEnv("CMDB_DEFAULT_BAND_ID", "0");
        await expect(loadAuthorization(sessionForAccount(), configuredBandScope)).rejects.toThrow("positive integer");
        vi.spyOn(authorizationTestDb.getDelegate("globalRole"), "findMany").mockRejectedValue(new Error("database unavailable"));
        await expect(loadAuthorization(sessionForAccount(), bandA)).rejects.toThrow("database unavailable");
    });

    it("refreshes non-session callers from the database instead of trusting a stale user", async () => {
        const auth = await loadAuthorizationForUser({ id: 42 }, database, bandB);
        expect(auth.hasPermission(Permission.view_songs)).toBe(true);
        await authorizationTestDb.getDelegate("user").deleteMany();
        expect((await loadAuthorizationForUser({ id: 42 }, database, bandB)).user).toBeNull();
    });

    it("rechecks account identity and grants before creating session public data", async () => {
        const staleUser = (await loadAuthorizationForUser({ id: 42 }, database, bandA)).requireUser().user;
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { isSysAdmin: true } });
        const publicData = await createPublicDataFromDatabase(database, { user: staleUser }, platformScope);
        expect(publicData.isSysAdmin).toBe(true);
        expect(publicData.permissionNames).toContain(Permission.manage_global_users);
        expect(publicData.permissionNames).not.toContain(Permission.manage_events);
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { mergedIntoUserId: 99 } });
        await expect(createPublicDataFromDatabase(database, { user: staleUser }, platformScope)).rejects.toThrow();
    });

    it("reserves shared-account changes for platform grants instead of band management", async () => {
        const bandAuth = await loadAuthorization(sessionForAccount(), bandA);
        const bandActor = { principal: bandAuth.user, auth: bandAuth };
        const target = { principal: { ...account, id: 99 }, rolePermissions: bandAuth.bandPermissions };
        for (const action of ["assignRole", "deactivate", "merge"] as const) {
            expect(canManageUser({ actor: bandActor, target, action })).toBe(false);
        }
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { isSysAdmin: true } });
        const platformAuth = await loadAuthorization(sessionForAccount(), platformScope);
        const platformActor = { principal: platformAuth.user, auth: platformAuth };
        expect(canManageUser({ actor: platformActor, target, action: "deactivate" })).toBe(true);
        expect(canManageUser({ actor: platformActor, target: {
            ...target, principal: { ...target.principal, isDeleted: true },
        }, action: "reactivate" })).toBe(true);
    });

    it("resolves only enabled, active locales and keys cache snapshots by locale", async () => {
        const session = sessionForAccount();
        const french = await loadAuthorization(session, { ...bandA, locale: "fr-FR" });
        expect(french.locale?.ietfTag).toBe("fr-BE");
        await authorizationTestDb.getDelegate("locale").update({ where: { id: 2 }, data: { isDeleted: true } });
        expect((await french.refresh(database)).locale?.ietfTag).toBe("en-US");
        await authorizationTestDb.getDelegate("bandLocale").deleteMany({ where: { bandId: 1 } });
        await expect(loadAuthorization(sessionForAccount(), bandA)).rejects.toThrow("No active locale");
    });

    it("allows an empty fresh platform to bootstrap before its first band exists", async () => {
        delete process.env.CMDB_DEFAULT_BAND_ID;
        await authorizationTestDb.getDelegate("band").deleteMany();
        const auth = await loadAuthorization(sessionForAccount());
        expect(auth.band).toBeNull();
        expect(auth.hasPermission(Permission.login)).toBe(true);
        await expect(loadAuthorization(sessionForAccount(), bandA)).rejects.toThrow("unavailable");
    });

    it("requires one active designated Sysadmin role and adds missing required grants there", async () => {
        await authorizationTestDb.getDelegate("globalRolePermission").deleteMany();
        await assertValidSysadminRole(database);
        expect(authorizationTestDb.snapshot("globalRolePermission")).toEqual(expect.arrayContaining([
            expect.objectContaining({ globalRoleId: 30, permissionId: permissionId(Permission.sysadmin) }),
            expect.objectContaining({ globalRoleId: 30, permissionId: permissionId(Permission.login) }),
        ]));
        await authorizationTestDb.getDelegate("globalRole").create({ data: { isSysAdminRole: true, isDeleted: false } });
        await expect(assertValidSysadminRole(database)).rejects.toThrow("exactly one active designated");
    });

    it("creates an account with no global elevation or automatic band membership", async () => {
        await authorizationTestDb.getDelegate("user").deleteMany();
        await authorizationTestDb.getDelegate("bandUser").deleteMany();
        await authorizationTestDb.getDelegate("bandRole").deleteMany({ where: { isRoleForNewUsers: true } });
        const ctx = createAuthorizationTestContext(null);
        const result = await invokeResolver(signup, {
            email: "new@test.invalid", name: "New person", password: "valid password",
        }, ctx);
        expect(result).toMatchObject({ name: "New person" });
        expect(authorizationTestDb.snapshot("user")[0]).toMatchObject({ globalRoleId: null, isSysAdmin: false });
        expect(authorizationTestDb.snapshot("bandUser")).toEqual([]);
        expect(ctx.session.$publicData.permissionNames).toContain(Permission.login);
        expect(ctx.session.$publicData.authorizationBandPublicId).toBeNull();
    });

    it("claims platform bootstrap into a global role without modifying memberships", async () => {
        vi.stubEnv("CMDB_ADMIN_BOOTSTRAP_SECRET", "a-long-bootstrap-secret-over-32-characters");
        const ctx = { ...createAuthorizationTestContext(null), session: sessionForAccount() };
        await invokeResolver(claimAdminBootstrap, { secret: process.env.CMDB_ADMIN_BOOTSTRAP_SECRET! }, ctx);
        expect(authorizationTestDb.snapshot("user")[0]).toMatchObject({ globalRoleId: 30, isSysAdmin: true });
        expect(authorizationTestDb.snapshot("bandUser")).toHaveLength(2);
        expect(ctx.session.$publicData.permissionNames).toContain(Permission.sysadmin);
        expect(ctx.session.$publicData.authorizationBandPublicId).toBeNull();
    });

    it("does not promote the account or consume bootstrap on an invalid secret", async () => {
        vi.stubEnv("CMDB_ADMIN_BOOTSTRAP_SECRET", "a-long-bootstrap-secret-over-32-characters");
        const ctx = { ...createAuthorizationTestContext(null), session: sessionForAccount() };
        await expect(invokeResolver(claimAdminBootstrap, {
            secret: "a-wrong-bootstrap-secret-over-32-characters",
        }, ctx)).rejects.toThrow("bootstrap is unavailable");
        expect(authorizationTestDb.snapshot("user")[0]).toMatchObject({ isSysAdmin: false, globalRoleId: null });
        expect(authorizationTestDb.snapshot("adminBootstrapClaim")).toEqual([]);
    });

    it("retains one-time bootstrap claims across accounts", async () => {
        const secret = "a-long-bootstrap-secret-over-32-characters";
        vi.stubEnv("CMDB_ADMIN_BOOTSTRAP_SECRET", secret);
        vi.stubEnv("CMDB_ADMIN_BOOTSTRAP_ONE_TIME_USE", "1");
        const first = { ...createAuthorizationTestContext(null), session: sessionForAccount() };
        await invokeResolver(claimAdminBootstrap, { secret }, first);
        await authorizationTestDb.getDelegate("user").create({ data: {
            ...account, id: 99, publicId: publicId("User", 99), email: "second@test.invalid",
        } });
        const second = createAuthorizationTestContext(null);
        second.session.$publicData.userId = 99;
        await expect(invokeResolver(claimAdminBootstrap, { secret }, second)).rejects.toThrow("bootstrap is unavailable");
        expect(authorizationTestDb.snapshot("user").find(user => user.id === 99))
            .toMatchObject({ isSysAdmin: false, globalRoleId: null });
    });

    it.each(["isDeleted", "mergedIntoUserId"])("rejects inactive sign-in targets (%s)", async field => {
        await authorizationTestDb.getDelegate("userSignInMethod").create({ data: {
            id: 1, userId: 42, type: "email", identifier: account.email,
        } });
        const method = { type: "email", identifier: account.email } as const;
        expect((await findSignInUser(database, method, { allowInactive: false }))?.id).toBe(42);
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: {
            [field]: field === "isDeleted" ? true : 99,
        } });
        expect(await findSignInUser(database, method, { allowInactive: false })).toBeNull();
    });
});
