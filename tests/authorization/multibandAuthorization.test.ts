import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gPermissionRegistry, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { CMDBResolverAuthorize } from "types";
import { CMClientAuthorization } from "src/auth/shared/cmAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { createAuthorizationTestContext } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";

// Vitest hoists mock factories; load their dependencies inside the factory.
vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { loadAuthorization, loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { resolveRequestLocale } from "src/locale/server/requestLocale";
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
const bandA = parsePublicId<"Band">(publicId("Band", 1));
const bandB = parsePublicId<"Band">(publicId("Band", 2));
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
    beforeEach(resetFixture);

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
        const sharedData = { ...session.$publicData, permissionNames: [...(session.$publicData.permissionNames ?? [])] };
        expect(await loadAuthorization(session, bandA)).toBe(first);
        expect(session.$publicData).toEqual(sharedData);
        expect(session.$publicData).not.toHaveProperty("authorizationBandPublicId");
        expect(session.$publicData).not.toHaveProperty("authorizationLocale");
        expect(session.$publicData.permissionNames).not.toContain(Permission.manage_events);
        expect(session.$publicData.permissionNames).not.toContain(Permission.view_songs);
    });

    it("keeps two tabs in different bands and locales independent while they share a session", async () => {
        const user = (await loadAuthorizationForUser({ id: 42 }, database)).requireUser().user;
        const session = sessionForAccount();
        Object.assign(session.$publicData, await createPublicDataFromDatabase(database, { user }));
        const sharedData = { ...session.$publicData, permissionNames: [...(session.$publicData.permissionNames ?? [])] };
        const writes = vi.spyOn(session, "$setPublicData");
        // Distinct request contexts use the same session handle and shared cookie
        // state. A write by either tab would be visible to both.
        const firstRequest = { ...session, get userId() { return session.userId; } };
        const secondRequest = { ...session, get userId() { return session.userId; } };
        const [first, second] = await Promise.all([
            loadAuthorization(firstRequest, bandA),
            loadAuthorization(secondRequest, bandB),
        ]);
        expect(first.sessionHandle).toBe(second.sessionHandle);
        const [firstLocale, secondLocale] = await Promise.all([
            resolveRequestLocale(database, first.requireBand().id, "fr-BE"),
            resolveRequestLocale(database, second.requireBand().id, "nl-BE"),
        ]);
        const firstTab = { authorization: first.toClientContext(), locale: firstLocale.ietfTag };
        const secondTab = { authorization: second.toClientContext(), locale: secondLocale.ietfTag };
        expect(firstTab).toMatchObject({ locale: "fr-BE", authorization: {
            bandPublicId: bandA, bandUserPublicId: publicId("BandUser", 1),
        } });
        expect(secondTab).toMatchObject({ locale: "nl-BE", authorization: {
            bandPublicId: bandB, bandUserPublicId: publicId("BandUser", 2),
        } });
        const firstClient = new CMClientAuthorization(user, new PermissionSet(firstTab.authorization.effectivePermissionNames));
        const secondClient = new CMClientAuthorization(user, new PermissionSet(secondTab.authorization.effectivePermissionNames));
        expect(firstClient.hasPermission(Permission.manage_events)).toBe(true);
        expect(firstClient.hasPermission(Permission.view_songs)).toBe(false);
        expect(secondClient.hasPermission(Permission.view_songs)).toBe(true);
        expect(secondClient.hasPermission(Permission.manage_events)).toBe(false);
        expect(firstTab.authorization).not.toHaveProperty("userId");
        expect(firstTab.authorization).not.toHaveProperty("bandId");
        expect(firstTab.authorization).not.toHaveProperty("effectivePermissions");
        expect(firstTab.authorization).not.toHaveProperty("locale");

        await authorizationTestDb.getDelegate("bandUser").update({ where: { id: 2 }, data: { isDeleted: true } });
        const nextSecondRequest = { ...session, get userId() { return session.userId; } };
        const nextSecond = await loadAuthorization(nextSecondRequest, bandB);
        const nextSecondLocale = await resolveRequestLocale(database, nextSecond.requireBand().id, "en-US");
        const nextSecondTab = { authorization: nextSecond.toClientContext(), locale: nextSecondLocale.ietfTag };
        expect(nextSecondTab.authorization.bandUserPublicId).toBeNull();
        expect(nextSecondTab.authorization.effectivePermissionNames).not.toContain(Permission.view_songs);
        expect(firstTab.locale).toBe("fr-BE");
        expect(firstClient.hasPermission(Permission.manage_events)).toBe(true);
        expect(session.$publicData).toEqual(sharedData);
        expect(writes).not.toHaveBeenCalled();
    });

    it("does not put grants sourced from a selected member role into the shared session", async () => {
        await authorizationTestDb.getDelegate("bandRolePermission").create({
            data: bandGrant(100, 20, Permission.practice_tools_use),
        });
        const session = sessionForAccount();
        expect((await loadAuthorization(session, bandA)).hasPermission(Permission.practice_tools_use)).toBe(true);
        expect(session.$publicData.permissionNames).not.toContain(Permission.practice_tools_use);
        expect((await loadAuthorization(session, bandB)).hasPermission(Permission.practice_tools_use)).toBe(false);
        expect(session.$publicData.permissionNames).not.toContain(Permission.practice_tools_use);
    });

    it.each([false, true])("preserves the GlobalRole administrator's inspector preference (%s) without a legacy flag", async showAdminControls => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: account.id }, data: { globalRoleId: 30 } });
        const session = sessionForAccount();
        session.$publicData.showAdminControls = showAdminControls;
        const auth = await loadAuthorization(session, bandA);
        expect(auth.hasPermission(Permission.sysadmin)).toBe(true);
        expect(auth.user?.isSysAdmin).toBe(false);
        expect(session.$publicData.showAdminControls).toBe(showAdminControls);
        const nextRequest = { ...session, get userId() { return session.userId; } };
        await loadAuthorization(nextRequest, bandB);
        expect(session.$publicData.showAdminControls).toBe(showAdminControls);
    });

    it("clears the inspector preference on fresh GlobalRole revocation while keeping account login", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: account.id }, data: { globalRoleId: 30 } });
        const session = sessionForAccount();
        session.$publicData.showAdminControls = true;
        await loadAuthorization(session, bandA);
        expect(session.$publicData.showAdminControls).toBe(true);
        await authorizationTestDb.getDelegate("user").update({ where: { id: account.id }, data: { globalRoleId: null } });
        const nextRequest = { ...session, get userId() { return session.userId; } };
        await loadAuthorization(nextRequest, bandB);
        expect(session.$publicData.showAdminControls).toBe(false);
        expect(session.$publicData.permissionNames).not.toContain(Permission.sysadmin);
        expect(session.userId).toBe(account.id);
    });

    it("does not preserve a forged inspector preference through cookie flags or band grants", async () => {
        await authorizationTestDb.getDelegate("bandRolePermission").create({ data: bandGrant(100, 20, Permission.sysadmin) });
        const session = sessionForAccount();
        session.$publicData.isSysAdmin = true;
        session.$publicData.showAdminControls = true;
        await loadAuthorization(session, bandA);
        expect(session.$publicData.showAdminControls).toBe(false);
        expect(session.$publicData.permissionNames).not.toContain(Permission.sysadmin);
    });

    it("rejects cookie-based band guards despite stale scope data", async () => {
        const session = sessionForAccount();
        Object.assign(session.$publicData, {
            authorizationBandPublicId: bandA, authorizationLocale: "fr-BE",
            permissionNames: [Permission.manage_events, Permission.view_songs, Permission.login],
            impersonatingFromUserId: 99,
        });
        const ctx = { ...createAuthorizationTestContext(null), session };
        expect(CMDBResolverAuthorize({ ctx, args: [Permission.manage_events] })).toBe(false);
        expect(CMDBResolverAuthorize({ ctx, args: [Permission.login] })).toBe(true);
        const auth = await loadAuthorization(session, bandB);
        expect(auth.hasPermission(Permission.view_songs)).toBe(true);
        // Match the cookie/database serialization performed by Blitz.
        const persistedData: unknown = JSON.parse(JSON.stringify(session.$publicData));
        expect(persistedData).toHaveProperty("permissionNames", auth.sessionPermissions.names);
        expect(persistedData).toMatchObject({ impersonatingFromUserId: 99 });
    });

    it("keeps platform context free of membership grants", async () => {
        const session = sessionForAccount();
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("band"), "findFirst");
        const auth = await loadAuthorization(session);
        expect(await loadAuthorization(session, null)).toBe(auth);
        expect(auth.band).toBeNull();
        expect(auth.membership).toBeNull();
        expect(auth.hasPermission(Permission.login)).toBe(true);
        expect(auth.hasPermission(Permission.manage_events)).toBe(false);
        expect(() => auth.requireBand()).toThrow("band context");
        expect((await auth.refresh(database)).band).toBeNull();
        expect(lookup).not.toHaveBeenCalled();
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
        expect(first.sessionPermissions.includesName(Permission.sysadmin)).toBe(true);
        expect(first.sessionPermissions.includesName(Permission.manage_events)).toBe(false);
        await authorizationTestDb.getDelegate("globalRolePermission").deleteMany({ where: { permissionId: permissionId(Permission.sysadmin) } });
        expect((await loadAuthorization(sessionForAccount(), bandB)).hasPermission(Permission.sysadmin)).toBe(false);
        expect((await loadAuthorization(sessionForAccount())).hasPermission(Permission.manage_events)).toBe(false);
    });

    it("honors an assigned global role without requiring the Sysadmin display flag", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { globalRoleId: 30 } });
        const auth = await loadAuthorization(sessionForAccount());
        expect(auth.user?.isSysAdmin).toBe(false);
        expect(auth.hasPermission(Permission.manage_global_users)).toBe(true);
        for (const bandPublicId of [bandA, bandB]) {
            expect((await loadAuthorization(sessionForAccount(), bandPublicId)).hasPermission(Permission.manage_global_users)).toBe(true);
        }
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

    it("rejects unavailable bands and database errors", async () => {
        const original = await loadAuthorization(sessionForAccount(), bandB);
        await authorizationTestDb.getDelegate("band").update({ where: { id: 2 }, data: { isDeleted: true } });
        await expect(loadAuthorization(sessionForAccount(), bandB)).rejects.toThrow("unavailable");
        await expect(original.refresh(database)).rejects.toThrow("unavailable");
        await expect(loadAuthorization(sessionForAccount(), parsePublicId<"Band">(publicId("Band", 99)))).rejects.toThrow("unavailable");
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
        const publicData = await createPublicDataFromDatabase(database, { user: staleUser });
        expect(publicData.isSysAdmin).toBe(true);
        expect(publicData.permissionNames).toContain(Permission.manage_global_users);
        expect(publicData.permissionNames).not.toContain(Permission.manage_events);
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { mergedIntoUserId: 99 } });
        await expect(createPublicDataFromDatabase(database, { user: staleUser })).rejects.toThrow();
    });

    it("creates band-independent session data without resolving a band or locale", async () => {
        const user = (await loadAuthorizationForUser({ id: 42 }, database)).requireUser().user;
        await authorizationTestDb.getDelegate("band").deleteMany();
        await authorizationTestDb.getDelegate("locale").deleteMany();
        const publicData = await createPublicDataFromDatabase(database, { user });
        expect(publicData.permissionNames).toContain(Permission.login);
        expect(publicData.permissionNames).not.toContain(Permission.manage_events);
        expect(publicData).not.toHaveProperty("authorizationBandPublicId");
        expect(publicData).not.toHaveProperty("authorizationLocale");
    });

    it("reserves shared-account changes for platform grants instead of band management", async () => {
        const bandAuth = await loadAuthorization(sessionForAccount(), bandA);
        const bandActor = { principal: bandAuth.user, auth: bandAuth };
        const target = { principal: { ...account, id: 99 }, rolePermissions: bandAuth.bandPermissions };
        for (const action of ["assignRole", "deactivate", "merge"] as const) {
            expect(canManageUser({ actor: bandActor, target, action })).toBe(false);
        }
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { isSysAdmin: true } });
        const platformAuth = await loadAuthorization(sessionForAccount());
        const platformActor = { principal: platformAuth.user, auth: platformAuth };
        expect(canManageUser({ actor: platformActor, target, action: "deactivate" })).toBe(true);
        expect(canManageUser({ actor: platformActor, target: {
            ...target, principal: { ...target.principal, isDeleted: true },
        }, action: "reactivate" })).toBe(true);
    });

    it("reuses authorization when the presentation locale changes", async () => {
        const session = sessionForAccount();
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        const auth = await loadAuthorization(session, bandA);
        expect((await resolveRequestLocale(database, auth.requireBand().id, "fr-BE")).ietfTag).toBe("fr-BE");
        expect((await resolveRequestLocale(database, auth.requireBand().id, "nl-BE")).ietfTag).toBe("nl-BE");
        expect(await loadAuthorization(session, bandA)).toBe(auth);
        expect(lookup).toHaveBeenCalledOnce();
        expect(auth).not.toHaveProperty("locale");
        expect(auth.requireBand()).not.toHaveProperty("locales");
        expect(auth.toClientContext()).not.toHaveProperty("locale");
    });

    it("authorizes and refreshes a band with no enabled locales", async () => {
        await authorizationTestDb.getDelegate("bandLocale").deleteMany({ where: { bandId: 1 } });
        const auth = await loadAuthorization(sessionForAccount(), bandA);
        expect(auth.hasPermission(Permission.manage_events)).toBe(true);
        expect((await auth.refresh(database)).hasPermission(Permission.manage_events)).toBe(true);
        expect(auth.requireUser().toClientContext().bandUserPublicId).toBe(publicId("BandUser", 1));
        await expect(resolveRequestLocale(database, auth.requireBand().id)).rejects.toThrow("No active locale");
    });

    it.each([undefined, bandA])("does not query locales during authorization (%s)", async bandPublicId => {
        await authorizationTestDb.getDelegate("locale").deleteMany();
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("locale"), "findMany")
            .mockRejectedValue(new Error("locale database unavailable"));
        const auth = await loadAuthorization(sessionForAccount(), bandPublicId);
        expect(auth.hasPermission(Permission.login)).toBe(true);
        expect((await auth.refresh(database)).hasPermission(Permission.login)).toBe(true);
        expect((await loadAuthorizationForUser({ id: 42 }, database, bandPublicId)).hasPermission(Permission.login)).toBe(true);
        expect(lookup).not.toHaveBeenCalled();
    });

    it("allows an empty fresh platform to bootstrap before its first band exists", async () => {
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
        expect(ctx.session.$publicData).not.toHaveProperty("authorizationBandPublicId");
    });

    it("claims platform bootstrap into a global role without modifying memberships", async () => {
        vi.stubEnv("CMDB_ADMIN_BOOTSTRAP_SECRET", "a-long-bootstrap-secret-over-32-characters");
        const ctx = { ...createAuthorizationTestContext(null), session: sessionForAccount() };
        await invokeResolver(claimAdminBootstrap, { secret: process.env.CMDB_ADMIN_BOOTSTRAP_SECRET! }, ctx);
        expect(authorizationTestDb.snapshot("user")[0]).toMatchObject({ globalRoleId: 30, isSysAdmin: true });
        expect(authorizationTestDb.snapshot("bandUser")).toHaveLength(2);
        expect(ctx.session.$publicData.permissionNames).toContain(Permission.sysadmin);
        expect(ctx.session.$publicData).not.toHaveProperty("authorizationBandPublicId");
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
