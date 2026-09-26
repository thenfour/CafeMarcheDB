import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import getDashboardData from "src/auth/queries/getDashboardData";
import { resolver, type CMAuthenticatedCtx, type CMCtx } from "src/auth/server/cmResolver";
import { loadAuthorization } from "src/auth/server/requestAuthorization";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationPublicData, createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { invokeResolver } from "./support/resolverHarness";

describe("authorization refresh on every request", () => {
    const user = createAuthorizationTestUser("normal", { id: 42 });
    beforeEach(() => authorizationTestDb.reset({ user: [user] }));

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
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        const roles = vi.spyOn(authorizationTestDb.getDelegate("role"), "findMany");
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
        authorizationTestDb.reset({
            user: [createAuthorizationTestUser("normal", {
                id: user.id, permissions: [Permission.login, Permission.admin_songs],
            })]
        });
        const second = createAuthorizationTestContext(user).session;
        expect(second.$handle).toBe(first.$handle);
        await loadAuthorization(second);
        expect(second.$publicData.permissionNames).toContain(Permission.admin_songs);
        expect(second.$publicData.permissionNames).not.toContain(Permission.view_users_basic_info);
        expect(second.userId).toBe(user.id);
    });

    it("removes revoked grants when no new grant replaces them", async () => {
        const previousUser = createAuthorizationTestUser("normal", {
            id: user.id, permissions: [Permission.login, Permission.admin_events],
        });
        const { session } = createAuthorizationTestContext(previousUser);
        const setPublicData = vi.spyOn(session, "$setPublicData");
        await loadAuthorization(session);
        expect(session.$publicData.permissionNames).not.toContain(Permission.admin_events);
        expect(session.$publicData.permissionNames).toContain(Permission.login);
        expect(setPublicData).toHaveBeenCalledOnce();
    });

    it("replaces equal-count grants while preserving identity and impersonation metadata", async () => {
        const previousUser = createAuthorizationTestUser("normal", {
            id: user.id, permissions: [Permission.login, Permission.view_users_basic_info],
        });
        const { session } = createAuthorizationTestContext(previousUser);
        session.$publicData.impersonatingFromUserId = 99;
        const handle = session.$handle;
        const revoke = vi.spyOn(session, "$revoke");
        authorizationTestDb.reset({
            user: [createAuthorizationTestUser("normal", {
                id: user.id, permissions: [Permission.login, Permission.admin_events],
            })]
        });
        await loadAuthorization(session);
        expect(session.$publicData.permissionNames).toContain(Permission.admin_events);
        expect(session.$publicData.permissionNames).not.toContain(Permission.view_users_basic_info);
        expect(session.$publicData.impersonatingFromUserId).toBe(99);
        expect(session.userId).toBe(user.id);
        expect(session.$handle).toBe(handle);
        expect(revoke).not.toHaveBeenCalled();
    });

    it.each([false, true])("refreshes public-role grants on the next request (authenticated: %s)", async authenticated => {
        const principal = authenticated ? user : null;
        const first = createAuthorizationTestContext(principal).session;
        await loadAuthorization(first);
        const publicRole = authorizationTestDb.getDelegate("role").snapshot().find(role => role.isPublicRole)!;
        await authorizationTestDb.getDelegate("role").update({
            where: { id: publicRole.id },
            data: { permissions: [{ permissionId: 123, permission: { id: 123, name: Permission.admin_events } }] },
        });
        const second = createAuthorizationTestContext(principal).session;
        await loadAuthorization(second);
        expect(second.$publicData.permissionNames).toContain(Permission.admin_events);
        expect(second.$publicData.permissionNames).not.toContain(Permission.practice_tools_use);
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

    it("drops assigned-role grants when the role is removed", async () => {
        const { session } = createAuthorizationTestContext(user);
        authorizationTestDb.reset({ user: [{ ...user, roleId: null, role: null }] });
        await loadAuthorization(session);
        expect(session.$publicData.permissionNames).not.toContain(Permission.login);
        expect(session.$publicData.permissionNames).toContain(Permission.public);
        expect(session.userId).toBe(user.id);
    });

    it.each([false, true])("revokes a missing or deleted account (deleted: %s)", async isDeleted => {
        authorizationTestDb.reset({ user: isDeleted ? [{ ...user, isDeleted: true }] : [] });
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
        vi.spyOn(authorizationTestDb.getDelegate("role"), "findMany").mockRejectedValue(new Error("database unavailable"));
        const setPublicData = vi.spyOn(session, "$setPublicData");
        await expect(loadAuthorization(session)).rejects.toThrow("database unavailable");
        expect(setPublicData).not.toHaveBeenCalled();
    });

    it("loads anonymous dashboard data through the same request snapshot", async () => {
        authorizationTestDb.reset({
            user: [user],
            permission: [{
                id: 30,
                publicId: parsePublicId<"Permission">("DashboardPerm001"),
                name: Permission.visibility_public,
                description: "Public",
                sortOrder: 1,
                isVisibility: true,
                significance: null,
                color: "green",
                iconName: null,
            }],
            userTag: [{
                id: 40,
                publicId: parsePublicId<"UserTag">("DashboardUsrTag1"),
                text: "Members",
                description: "Members only",
                color: "blue",
                significance: null,
                sortOrder: 1,
                cssClass: null,
            }],
            wikiPageTag: [{
                id: 50,
                publicId: parsePublicId<"WikiPageTag">("DashboardWikiTag"),
                text: "Policy",
                description: "Policy page",
                color: "orange",
                significance: null,
                sortOrder: 1,
            }],
        });
        const ctx = createAuthorizationTestContext(null);
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst");
        await loadAuthorization(ctx.session);
        await expect(invokeResolver(getDashboardData, {}, ctx)).resolves.toMatchObject({
            relevantEventIds: [],
            effectivePermissionNames: expect.not.arrayContaining([Permission.login]),
            permission: [{
                publicId: parsePublicId<"Permission">("DashboardPerm001"),
                name: Permission.visibility_public,
                color: "green",
            }],
            userTag: [],
            role: [],
            wikiPageTag: [],
        });
        expect(lookup).not.toHaveBeenCalled();
    });

    it("passes the loaded authorization to resolver steps", async () => {
        const ctx = createAuthorizationTestContext(user);
        const guarded = resolver.pipe(
            resolver.cmauthorize(Permission.login),
            async (_input: {}, resolverCtx: CMAuthenticatedCtx) => ({
                userId: resolverCtx.auth.user.id,
                canViewUsers: resolverCtx.auth.hasPermission(Permission.view_users_basic_info),
            }),
        );

        await expect(invokeResolver(guarded, {}, ctx)).resolves.toEqual({
            userId: user.id,
            canViewUsers: true,
        });
        const anonymous = createAuthorizationTestContext(null);
        await expect(invokeResolver(guarded, {}, anonymous)).rejects.toThrow();

        const publicResolver = resolver.pipe(
            resolver.cmauthorize(Permission.public),
            async (_input: {}, resolverCtx: CMCtx) => resolverCtx.auth.userId,
        );
        await expect(invokeResolver(publicResolver, {}, anonymous)).resolves.toBeNull();
    });

    it("returns a new snapshot after a grant changes", async () => {
        const actor = createAuthorizationTestUser("normal", {
            id: user.id,
            permissions: [Permission.login, Permission.admin_songs],
        });
        authorizationTestDb.reset({ user: [actor] });
        const original = await loadAuthorization(createAuthorizationTestContext(actor).session);
        authorizationTestDb.reset({ user: [createAuthorizationTestUser("normal", {
            id: user.id,
            permissions: [Permission.login],
        })] });

        const refreshed = await original.refresh(authorizationTestDb);
        expect(refreshed).not.toBe(original);
        expect(original.hasPermission(Permission.admin_songs)).toBe(true);
        expect(refreshed.hasPermission(Permission.admin_songs)).toBe(false);
        expect(refreshed.hasPermission(Permission.never_grant)).toBe(false);
        expect(() => refreshed.requirePermission(Permission.admin_songs)).toThrow("Not authorized for admin_songs");

        authorizationTestDb.reset({ user: [{ ...actor, isDeleted: true }] });
        const deleted = await original.refresh(authorizationTestDb);
        expect(deleted.user).toBeNull();
        expect(deleted.hasPermission(Permission.login)).toBe(false);
    });
});
