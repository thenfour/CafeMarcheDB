import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission, gPermissionRegistry, getPermissionDefinition } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import getDashboardData from "src/auth/queries/getDashboardData";
import { cmauthorize, type CMAuthCtxWithUser, type CMAuthCtx } from "src/auth/server/cmResolver";
import type { AuthorizationDatabase } from "src/auth/server/authorizationContext";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationPublicData, createAuthorizationTestContext, createAuthorizationTestUser, testPublicRolePermissions, type AuthorizationTestUser } from "./support/authorizationFixtures";
import { invokeResolver } from "./support/resolverHarness";
import { resolver } from "@blitzjs/rpc";

// The fake implements the authorization queries used by these request-level tests.
const database = authorizationTestDb as unknown as AuthorizationDatabase;
const permissionId = (permission: Permission) => gPermissionRegistry.findIndex(definition => definition.key === permission) + 1;

/** Persist separate global/public role grants; legacy fixture roles describe stale session data only. */
function seedSessionAuthorization(principal: AuthorizationTestUser | null) {
    const grants = principal?.globalRole?.permissions ?? [];
    authorizationTestDb.reset({
        user: principal ? [{ ...principal, globalRoleId: principal.globalRoleId, mergedIntoUserId: null }] : [],
        permission: gPermissionRegistry.map((definition, index) => ({ id: index + 1, name: definition.key, publicId: parsePublicId<"Permission">(`SessionPerm${String(index + 1).padStart(5, "0")}`), isDeleted: false,
            description: "", sortOrder: index, isVisibility: false, significance: null, color: null, iconName: null })),
        globalRole: [{ id: 900000, isPublicRole: true, isDeleted: false }, ...(principal?.globalRole ? [{ id: principal.globalRole.id, isDeleted: false, isSysAdminRole: false }] : [])],
        globalRolePermission: [
            ...testPublicRolePermissions.filter(name => getPermissionDefinition(name).scope === "global").map((name, index) => ({ id: 900000 + index, globalRoleId: 900000, permissionId: permissionId(name) })),
            ...grants.map((grant, index) => ({ id: index + 1, globalRoleId: principal!.globalRoleId, permissionId: permissionId(grant.permission.name) })),
        ],
        bandRole: [{ id: 1, isDeleted: false, isPublicRole: true, isRoleForNewUsers: false }],
        bandRolePermission: testPublicRolePermissions.filter(name => getPermissionDefinition(name).scope === "band").map((permission, index) => ({ id: index + 1, bandRoleId: 1, permissionId: permissionId(permission) })),
    });
}

describe("authorization refresh on every request", () => {
    const user = createAuthorizationTestUser("normal", { id: 42, permissions: [Permission.login, Permission.manage_global_users] });
    beforeEach(() => seedSessionAuthorization(user));

    it.each([null, undefined, 0])("loads public grants without a user lookup for userId %s", async userId => {
        const { session } = createAuthorizationTestContext(null);
        session.$publicData.userId = userId;
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        const revoke = vi.spyOn(session, "$revoke");
        const setPublicData = vi.spyOn(session, "$setPublicData");
        const result = await loadAuthorization(session);
        expect(result.user).toBeNull();
        expect(result.effectivePermissions.names).toContain(Permission.public);
        expect(lookup).not.toHaveBeenCalled();
        expect(revoke).not.toHaveBeenCalled();
        expect(setPublicData).not.toHaveBeenCalled();
    });

    it("shares concurrent reads within one request without session writes", async () => {
        const { session } = createAuthorizationTestContext(user);
        const expected = await loadAuthorization(createAuthorizationTestContext(user).session);
        session.$publicData.permissionNames = [...expected.sessionPermissions.names];
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        const roles = vi.spyOn(authorizationTestDb.getDelegate("globalRole"), "findMany");
        const setPublicData = vi.spyOn(session, "$setPublicData");
        const [first, second] = await Promise.all([
            loadAuthorization(session), loadAuthorization(session),
        ]);
        expect(first).toBe(second);
        await loadAuthorization(session);
        expect(lookup).toHaveBeenCalledOnce();
        expect(roles).toHaveBeenCalledOnce();
        expect(setPublicData).not.toHaveBeenCalled();
    });

    it("reads again on the next request with the same handle and no elapsed time", async () => {
        const first = createAuthorizationTestContext(user).session;
        await loadAuthorization(first);
        seedSessionAuthorization(createAuthorizationTestUser("normal", {
            id: user.id, permissions: [Permission.login, Permission.manage_global_localization],
        }));
        const second = createAuthorizationTestContext(user).session;
        expect(second.$handle).toBe(first.$handle);
        await loadAuthorization(second);
        expect(second.$publicData.permissionNames).toContain(Permission.manage_global_localization);
        expect(second.$publicData.permissionNames).not.toContain(Permission.manage_global_users);
        expect(second.userId).toBe(user.id);
    });

    it("removes revoked grants when no new grant replaces them", async () => {
        const previousUser = createAuthorizationTestUser("normal", {
            id: user.id, permissions: [Permission.login, Permission.manage_global_settings],
        });
        const { session } = createAuthorizationTestContext(previousUser);
        const setPublicData = vi.spyOn(session, "$setPublicData");
        await loadAuthorization(session);
        expect(session.$publicData.permissionNames).not.toContain(Permission.manage_global_settings);
        expect(session.$publicData.permissionNames).toContain(Permission.login);
        expect(setPublicData).toHaveBeenCalledOnce();
    });

    it("replaces equal-count grants while preserving identity and impersonation metadata", async () => {
        const previousUser = createAuthorizationTestUser("normal", {
            id: user.id, permissions: [Permission.login, Permission.manage_global_users],
        });
        const { session } = createAuthorizationTestContext(previousUser);
        session.$publicData.impersonatingFromUserId = 99;
        const handle = session.$handle;
        const revoke = vi.spyOn(session, "$revoke");
        seedSessionAuthorization(createAuthorizationTestUser("normal", {
            id: user.id, permissions: [Permission.login, Permission.manage_global_settings],
        }));
        await loadAuthorization(session);
        expect(session.$publicData.permissionNames).toContain(Permission.manage_global_settings);
        expect(session.$publicData.permissionNames).not.toContain(Permission.manage_global_users);
        expect(session.$publicData.impersonatingFromUserId).toBe(99);
        expect(session.userId).toBe(user.id);
        expect(session.$handle).toBe(handle);
        expect(revoke).not.toHaveBeenCalled();
    });

    it.each([false, true])("refreshes public-role grants on the next request (authenticated: %s)", async authenticated => {
        const principal = authenticated ? user : null;
        const first = createAuthorizationTestContext(principal).session;
        await loadAuthorization(first);
        const publicRole = authorizationTestDb.getDelegate("bandRole").snapshot().find(role => role.isPublicRole)!;
        await authorizationTestDb.getDelegate("bandRolePermission").deleteMany({ where: { bandRoleId: publicRole.id } });
        await authorizationTestDb.getDelegate("bandRolePermission").create({
            data: { bandRoleId: publicRole.id, permissionId: permissionId(Permission.manage_global_settings) },
        });
        const second = createAuthorizationTestContext(principal).session;
        await loadAuthorization(second);
        // Platform grants on a public band role cannot enter a shared session.
        expect(second.$publicData.permissionNames).not.toContain(Permission.manage_global_settings);
        expect(second.$publicData.permissionNames).toContain(Permission.practice_tools_use);
        expect(second.userId).toBe(first.userId);
    });

    it("removes Sysadmin grants and controls without logging out", async () => {
        const { session } = createAuthorizationTestContext(createAuthorizationTestUser("sysadmin", { id: user.id }));
        session.$publicData.showAdminControls = true;
        await loadAuthorization(session);
        expect(session.$publicData).toMatchObject({ isSysAdmin: false, showAdminControls: false });
        expect(session.$publicData.permissionNames).not.toContain(Permission.sysadmin);
        expect(session.userId).toBe(user.id);
    });

    it("selects Global Public without retaining login when the assigned role is cleared", async () => {
        const { session } = createAuthorizationTestContext(user);
        seedSessionAuthorization({ ...user, globalRoleId: null, globalRole: null });
        await loadAuthorization(session);
        expect(session.$publicData.permissionNames).not.toContain(Permission.manage_global_users);
        expect(session.$publicData.permissionNames).not.toContain(Permission.login);
        expect(session.$publicData.permissionNames).toContain(Permission.public);
        expect(session.userId).toBe(user.id);
    });

    it.each([false, true])("revokes a missing or deleted account (deleted: %s)", async isDeleted => {
        seedSessionAuthorization(isDeleted ? { ...user, isDeleted: true } : null);
        const { session } = createAuthorizationTestContext(user);
        const revoke = vi.spyOn(session, "$revoke");
        const result = await loadAuthorization(session);
        expect(revoke).toHaveBeenCalledOnce();
        expect(result.user).toBeNull();
        expect(session.userId).toBeFalsy();
        expect(result.effectivePermissions.names).not.toContain(Permission.login);
    });

    it("does not reuse anonymous authorization after login in the same request", async () => {
        const { session } = createAuthorizationTestContext(null);
        await loadAuthorization(session);
        await session.$create(createAuthorizationPublicData(user));
        const result = await loadAuthorization(session);
        expect(result.user?.id).toBe(user.id);
        expect(result.effectivePermissions.names).toContain(Permission.login);
    });

    it("fails closed when authorization cannot be read", async () => {
        const { session } = createAuthorizationTestContext(user);
        vi.spyOn(authorizationTestDb.getDelegate("globalRole"), "findMany").mockRejectedValue(new Error("database unavailable"));
        const setPublicData = vi.spyOn(session, "$setPublicData");
        await expect(loadAuthorization(session)).rejects.toThrow("database unavailable");
        expect(setPublicData).not.toHaveBeenCalled();
    });

    it("loads anonymous dashboard data through the same request snapshot", async () => {
        await authorizationTestDb.getDelegate("permission").update({
            where: { id: permissionId(Permission.visibility_public) },
            data: { publicId: parsePublicId<"Permission">("DashboardPerm001"), description: "Public",
                sortOrder: 1, isVisibility: true, significance: null, color: "green", iconName: null },
        });
        const ctx = createAuthorizationTestContext(null);
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        await loadAuthorization(ctx.session);
        await expect(invokeResolver(getDashboardData, {}, ctx)).resolves.toMatchObject({
            relevantEventIds: [],
            authorization: { effectivePermissionNames: expect.not.arrayContaining([Permission.login]) },
            permission: expect.arrayContaining([expect.objectContaining({
                publicId: parsePublicId<"Permission">("DashboardPerm001"),
                name: Permission.visibility_public,
                color: "green",
            })]),
            userTag: [],
            wikiPageTag: [],
        });
        expect(lookup).not.toHaveBeenCalled();
    });

    it("passes the loaded authorization to resolver steps", async () => {
        const ctx = createAuthorizationTestContext(user);
        const guarded = resolver.pipe(
            cmauthorize(Permission.login),
            async (_input: {}, resolverCtx: CMAuthCtxWithUser) => ({
                userId: resolverCtx.auth.user.id,
                canManageAccounts: resolverCtx.auth.hasPermission(Permission.manage_global_users),
            }),
        );

        await expect(invokeResolver(guarded, {}, ctx)).resolves.toEqual({
            userId: user.id,
            canManageAccounts: true,
        });
        const anonymous = createAuthorizationTestContext(null);
        await expect(invokeResolver(guarded, {}, anonymous)).rejects.toThrow();

        const publicResolver = resolver.pipe(
            cmauthorize(Permission.public),
            async (_input: {}, resolverCtx: CMAuthCtx) => resolverCtx.auth.userId,
        );
        await expect(invokeResolver(publicResolver, {}, anonymous)).resolves.toBeNull();
    });

    it("returns a new snapshot after a grant changes", async () => {
        const actor = createAuthorizationTestUser("normal", {
            id: user.id,
            permissions: [Permission.login, Permission.manage_global_localization],
        });
        seedSessionAuthorization(actor);
        const original = await loadAuthorization(createAuthorizationTestContext(actor).session);
        seedSessionAuthorization(createAuthorizationTestUser("normal", {
            id: user.id, permissions: [Permission.login],
        }));

        const refreshed = await original.refresh(database);
        expect(refreshed).not.toBe(original);
        expect(original.hasPermission(Permission.manage_global_localization)).toBe(true);
        expect(refreshed.hasPermission(Permission.manage_global_localization)).toBe(false);
        expect(refreshed.hasPermission(Permission.never_grant)).toBe(false);
        expect(() => refreshed.requirePermission(Permission.manage_global_localization)).toThrow("Not authorized for manage_global_localization");

        seedSessionAuthorization({ ...actor, isDeleted: true });
        const deleted = await original.refresh(database);
        expect(deleted.user).toBeNull();
        expect(deleted.hasPermission(Permission.login)).toBe(false);
    });

    it("refreshes selected-band grants without placing them in the shared session", async () => {
        const bandPublicId = parsePublicId<"Band">("SessionBand00001");
        authorizationTestDb.getDelegate("band").reset([{ id: 1, publicId: bandPublicId, isDeleted: false }]);
        authorizationTestDb.getDelegate("bandUser").reset([{
            id: 1, publicId: "SessionMember001", bandId: 1, userId: user.id, bandRoleId: 2, isDeleted: false,
        }]);
        await authorizationTestDb.getDelegate("bandRole").create({ data: { id: 2, isDeleted: false, isPublicRole: false } });
        const grant = await authorizationTestDb.getDelegate("bandRolePermission").create({
            data: { bandRoleId: 2, permissionId: permissionId(Permission.admin_events) },
        });
        const first = await loadAuthorization(createAuthorizationTestContext(user).session, bandPublicId);
        expect(first.hasPermission(Permission.admin_events)).toBe(true);
        expect(first.sessionPermissions.names).not.toContain(Permission.admin_events);
        await authorizationTestDb.getDelegate("bandRolePermission").delete({ where: { id: grant.id } });
        const refreshed = await first.refresh(database);
        const nextSession = createAuthorizationTestContext(user).session;
        const nextRequest = await loadAuthorization(nextSession, bandPublicId);
        expect(refreshed.hasPermission(Permission.admin_events)).toBe(false);
        expect(nextRequest.hasPermission(Permission.admin_events)).toBe(false);
        expect(nextSession.$publicData.permissionNames).not.toContain(Permission.admin_events);
        expect(nextSession.userId).toBe(user.id);
    });
});
