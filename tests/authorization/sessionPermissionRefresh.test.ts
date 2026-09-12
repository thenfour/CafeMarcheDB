import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { RefreshSessionPermissions } from "src/auth/queries/getDashboardData";
import { authorizationTestDb } from "./support/inMemoryPrisma";

describe("BA-R001 persisted session refresh", () => {
    beforeEach(() => authorizationTestDb.reset({ user: [] }));

    it("revokes the current session when its user no longer exists or is active", async () => {
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
