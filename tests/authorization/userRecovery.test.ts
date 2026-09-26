import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { Permission } from "shared/permissions";
import reactivateUser from "src/auth/mutations/reactivateUser";
import deactivateUser from "src/auth/mutations/deactivateUser";
import getUserManagementCapabilities from "src/auth/queries/getUserManagementCapabilities";
import { canManageUser } from "src/auth/server/userManagementPolicy";
import { loadAuthorizedPageEntity } from "src/auth/server/serverPageAuthorization";
import { getRequestAuthorization } from "src/auth/server/requestAuthorization";
import getUserExtraInfo from "src/core/db3/queries/getUserExtraInfo";
import db3queries from "src/core/db3/queries/db3queries";
import db3mutations from "tests/authorization/db3MutationTestResolver";
import { xUser } from "src/core/db3/db3";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import {
    asUserManagementActor,
    asUserManagementTarget,
    createAuthorizationTestContext,
    createAuthorizationTestUser,
} from "./support/authorizationFixtures";
import { forgeDb3Query, forgeDb3Update } from "./support/db3RequestBuilders";
import { invokeResolver } from "./support/resolverHarness";
import { userPublicId } from "tests/support/userFixtures";

const permissions = [Permission.login, Permission.search_users, Permission.view_users_basic_info,
Permission.view_user_contact_info, Permission.manage_users, Permission.deactivate_users, Permission.recover_users];
const admin = createAuthorizationTestUser("bandAdmin", { id: 801, permissions });
const target = {
    ...createAuthorizationTestUser("normal", { id: 802, isDeleted: true }),
    signInMethods: [{ id: 1, type: "google", identifier: "existing-google-identity" }], hashedPassword: "existing-password-hash"
};

describe("user recovery", () => {
    beforeEach(() => {
        authorizationTestDb.reset({ user: [admin, target], session: [{ id: 1, userId: target.id }], change: [] });
    });

    it("reactivates an ordinary user, preserving identity and role, revoking sessions and auditing the transition", async () => {
        await invokeResolver(reactivateUser, { userId: target.publicId }, createAuthorizationTestContext(admin));
        expect(authorizationTestDb.snapshot("user").find(row => row.id === target.id))
            .toEqual({ ...target, isDeleted: false });
        expect(authorizationTestDb.snapshot("session")).toEqual([]);
        expect(authorizationTestDb.snapshot("change")).toEqual([
            expect.objectContaining({ table: "User", recordId: target.id }),
        ]);
    });

    it("requires recovery independently of deactivation authority, even with a stale session grant", async () => {
        const actor = createAuthorizationTestUser("bandAdmin", {
            id: admin.id, permissions: permissions.filter(p => p !== Permission.recover_users),
        });
        authorizationTestDb.reset({ user: [actor, target], change: [] });
        await expect(invokeResolver(reactivateUser, { userId: target.publicId }, createAuthorizationTestContext(admin)))
            .rejects.toThrow("Not authorized to reactivate");
        expect(authorizationTestDb.snapshot("user").find(row => row.id === target.id)?.isDeleted).toBe(true);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it.each([
        createAuthorizationTestUser("sysadmin", { id: target.id, isDeleted: true }),
        createAuthorizationTestUser("normal", { id: target.id, isDeleted: true, permissions: [Permission.impersonate_user] }),
        createAuthorizationTestUser("normal", { id: target.id, isDeleted: true, permissions: [Permission.manage_songs] }),
    ])("rejects restoring protected or out-of-envelope accounts", async protectedTarget => {
        authorizationTestDb.reset({ user: [admin, protectedTarget], change: [] });
        await expect(invokeResolver(reactivateUser, { userId: target.publicId }, createAuthorizationTestContext(admin)))
            .rejects.toThrow("Not authorized to reactivate");
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("uses inherited Sysadmin permissions for recovery capabilities and the mutation", async () => {
        const sysadmin = createAuthorizationTestUser("sysadmin", { id: 803, permissions: [Permission.login] });
        const protectedTarget = createAuthorizationTestUser("sysadmin", { id: target.id, isDeleted: true });
        authorizationTestDb.reset({ user: [sysadmin, protectedTarget], change: [] });
        const ctx = createAuthorizationTestContext(sysadmin);
        await getRequestAuthorization(ctx.session);
        const caps = await invokeResolver(getUserManagementCapabilities, { userId: target.publicId }, ctx);
        expect(caps).toMatchObject({ canReactivate: true, canDeactivate: false, canAssignRole: false });
        await invokeResolver(reactivateUser, { userId: target.publicId }, ctx);
        expect(authorizationTestDb.snapshot("user").find(row => row.id === target.id)?.isDeleted).toBe(false);
    });

    it("does not allow a deleted actor to recover itself or another account", async () => {
        const deletedAdmin = { ...admin, isDeleted: true };
        expect(canManageUser({
            actor: asUserManagementActor(deletedAdmin),
            target: asUserManagementTarget(target),
            action: "reactivate",
        })).toBe(false);
        authorizationTestDb.reset({ user: [deletedAdmin, target], change: [] });
        await expect(invokeResolver(reactivateUser, { userId: target.publicId }, createAuthorizationTestContext(admin))).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("rejects repeat restoration and unknown users without producing an audit entry", async () => {
        authorizationTestDb.reset({ user: [admin, { ...target, isDeleted: false }], change: [] });
        await expect(invokeResolver(reactivateUser, { userId: target.publicId }, createAuthorizationTestContext(admin))).rejects.toThrow();
        await expect(invokeResolver(reactivateUser, { userId: userPublicId(999999) }, createAuthorizationTestContext(admin))).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it.each([false, true])("applies recover_users=%s to profile metadata, identity and DB3 reads", async canRecover => {
        const actor = createAuthorizationTestUser("bandAdmin", {
            id: admin.id, permissions: permissions.filter(p => canRecover || p !== Permission.recover_users),
        });
        authorizationTestDb.reset({ user: [actor, target] });
        const ctx = createAuthorizationTestContext(actor);
        const auth = await getRequestAuthorization(ctx.session);
        const profile = await loadAuthorizedPageEntity({
            ctx, permission: Permission.view_users_basic_info, table: xUser, identity: target.publicId,
            includeDeleted: auth.effectivePermissions.includesName(Permission.recover_users),
            load: where => authorizationTestDb.getDelegate("user").findFirst({ where }),
        });
        expect(profile?.id ?? null).toBe(canRecover ? target.id : null);
        const activeOnly = await invokeResolver(db3queries, forgeDb3Query("User"), ctx);
        expect(activeOnly.items.some(row => row.publicId === target.publicId)).toBe(false);
        if (canRecover) {
            const recovered = await invokeResolver(db3queries, forgeDb3Query("User", { includeDeleted: true }), ctx);
            expect(recovered.items).toContainEqual(expect.objectContaining({ publicId: target.publicId, isDeleted: true }));
            await expect(invokeResolver(getUserExtraInfo, { userId: target.publicId }, ctx)).resolves
                .toEqual({ signinMethods: ["google"] });
        } else {
            await expect(invokeResolver(db3queries, forgeDb3Query("User", { includeDeleted: true }), ctx)).rejects.toThrow();
            await expect(invokeResolver(getUserExtraInfo, { userId: target.publicId }, ctx)).rejects.toThrow();
            await expect(invokeResolver(getUserManagementCapabilities, { userId: target.publicId }, ctx)).rejects.toThrow();
        }
    });

    it("keeps generic user recovery disabled", async () => {
        await expect(invokeResolver(db3mutations, forgeDb3Update("User", target.id, { isDeleted: false }),
            createAuthorizationTestContext(admin))).rejects.toThrow();
    });

    it("completes deactivate and reactivate with refreshed capabilities", async () => {
        authorizationTestDb.reset({ user: [admin, { ...target, isDeleted: false }], session: [], change: [] });
        await invokeResolver(deactivateUser, { userId: target.publicId, acknowledgeContinuityRisk: false }, createAuthorizationTestContext(admin));
        expect(await invokeResolver(getUserManagementCapabilities, { userId: target.publicId }, createAuthorizationTestContext(admin)))
            .toMatchObject({ canReactivate: true, canDeactivate: false });
        await invokeResolver(reactivateUser, { userId: target.publicId }, createAuthorizationTestContext(admin));
        expect(await invokeResolver(getUserManagementCapabilities, { userId: target.publicId }, createAuthorizationTestContext(admin)))
            .toMatchObject({ canReactivate: false, canDeactivate: true });
        expect(authorizationTestDb.snapshot("change")).toHaveLength(2);
    });
});
