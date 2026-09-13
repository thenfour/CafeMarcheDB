import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import getDashboardData, { RefreshSessionPermissions } from "src/auth/queries/getDashboardData";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationTestContext } from "./support/authorizationFixtures";
import { invokeResolver } from "./support/resolverHarness";

describe("BA-R001 persisted session refresh", () => {
    beforeEach(() => authorizationTestDb.reset({ user: [] }));

    it.each([null, undefined, 0])("skips user refresh for an anonymous session with userId %s", async userId => {
        const ctx = createAuthorizationTestContext(null);
        ctx.session.$publicData.userId = userId;
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")
            .mockRejectedValue(new Error("Anonymous sessions must not query users"));
        const revoke = vi.fn();
        const setPublicData = vi.fn();
        ctx.session.$revoke = revoke;
        ctx.session.$setPublicData = setPublicData;

        await expect(RefreshSessionPermissions(ctx)).resolves.toBe(false);
        expect(lookup).not.toHaveBeenCalled();
        expect(revoke).not.toHaveBeenCalled();
        expect(setPublicData).not.toHaveBeenCalled();
    });

    it("loads dashboard data for a new anonymous session without a refresh timestamp", async () => {
        const ctx = createAuthorizationTestContext(null);
        ctx.session.$publicData.userId = null;
        delete ctx.session.$publicData.permissionsLastRefreshedAt;
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("user"), "findFirst")
            .mockRejectedValue(new Error("Anonymous sessions must not query users"));

        await expect(invokeResolver(getDashboardData, {}, ctx)).resolves.toMatchObject({
            relevantEventIds: [],
            effectivePermissions: expect.not.arrayContaining([Permission.login]),
        });
        expect(lookup).not.toHaveBeenCalled();
    });

    it.each([false, true])("revokes the session for a missing or deleted user (deleted: %s)", async isDeleted => {
        if (isDeleted) authorizationTestDb.reset({ user: [{ id: 42, isDeleted: true }] });
        const revoke = vi.fn();
        const setPublicData = vi.fn();
        const ctx = {
            session: {
                $publicData: {
                    userId: 42,
                    isSysAdmin: false,
                    permissions: ["login"],
                    permissionsLastRefreshedAt: new Date(0).toISOString(),
                },
                $revoke: revoke,
                $setPublicData: setPublicData,
            },
        } as any;

        await expect(RefreshSessionPermissions(ctx)).resolves.toBe(true);
        expect(revoke).toHaveBeenCalledOnce();
        expect(setPublicData).not.toHaveBeenCalled();
    });

    it("replaces the complete cached authorization state from the active database user", async () => {
        authorizationTestDb.reset({
            user: [{
                id: 42,
                isDeleted: false,
                isSysAdmin: false,
                role: null,
            }],
        });
        const setPublicData = vi.fn();
        const ctx = {
            session: {
                $publicData: {
                    userId: 42,
                    isSysAdmin: true,
                    permissions: [Permission.manage_events],
                    permissionsLastRefreshedAt: new Date(0).toISOString(),
                    showAdminControls: true,
                },
                $revoke: vi.fn(),
                $setPublicData: setPublicData,
            },
        } as any;

        await RefreshSessionPermissions(ctx);

        expect(setPublicData).toHaveBeenCalledWith(expect.objectContaining({
            isSysAdmin: false,
            showAdminControls: false,
            permissions: expect.not.arrayContaining([Permission.manage_events]),
        }));
    });
});
