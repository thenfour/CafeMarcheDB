import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission, gPermissionRegistry } from "shared/permissions";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "../authorization/support/authorizationFixtures";
import { authorizationTestDb } from "../authorization/support/inMemoryPrisma";
import { invokeResolver } from "../authorization/support/resolverHarness";
import updateSetting from "src/setting/server/mutations/updateSetting";
import updateBulkSettings from "src/setting/server/mutations/updateBulkSettings";
import { clearBrandCache } from "src/server/brand";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("../authorization/support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});
vi.mock("src/server/brand", () => ({ clearBrandCache: vi.fn() }));

const originalSetting = { id: 1, publicId: "Setting000000001", bandId: 1, name: "dateTime.bandTimeZone", value: "Europe/Brussels" };
const bandPublicId = "Band000000000001";
const context = () => createAuthorizationTestContext(createAuthorizationTestUser("normal", { id: 42 }));

beforeEach(() => {
    authorizationTestDb.reset({
        user: [{ id: 42, publicId: "User000000000042", globalRoleId: null, isDeleted: false, mergedIntoUserId: null, isSysAdmin: false }],
        band: [{ id: 1, publicId: bandPublicId, isDeleted: false }],
        bandUser: [{ id: 1, publicId: "Member0000000001", bandId: 1, userId: 42, bandRoleId: 11, isDeleted: false }],
        bandRole: [{ id: 11, isDeleted: false }],
        permission: gPermissionRegistry.map((definition, index) => ({ id: index + 1, name: definition.key, isDeleted: false })),
        bandRolePermission: [{ id: 1, bandRoleId: 11, permissionId: gPermissionRegistry.findIndex(definition => definition.key === Permission.manage_band_settings) + 1 }],
        bandSetting: [originalSetting],
    });
    vi.mocked(clearBrandCache).mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

function expectNoWrites() {
    expect(authorizationTestDb.snapshot("bandSetting")).toEqual([originalSetting]);
    expect(authorizationTestDb.snapshot("change")).toEqual([]);
    expect(clearBrandCache).not.toHaveBeenCalled();
}

describe("scoped timezone setting commands", () => {
    it.each(["Moon/Base", "+02:00", "2026-07-10T09:45+02:00", null, "", "   "])("rejects invalid value %j instead of treating it as reset", async value => {
        await expect(invokeResolver(updateSetting, { hive: "band", key: "dateTime.bandTimeZone", operation: { kind: "set", value }, bandPublicId }, context())).rejects.toThrow();
        expectNoWrites();
    });

    it.each(["DateTime.bandTimeZone", "dateTime.bandTimeZone ", "dateTime.bandTimeZoné"])("rejects nonregistered spelling %j before database collation can match", async key => {
        await expect(invokeResolver(updateSetting, { hive: "band", key, operation: { kind: "set", value: "Asia/Tokyo" }, bandPublicId }, context())).rejects.toThrow("Unknown");
        expectNoWrites();
    });

    it("validates a later command before committing any command", async () => {
        await expect(invokeResolver(updateBulkSettings, { bandPublicId, commands: [
            { hive: "user", key: "calendar.showDeclinedEvents", operation: { kind: "set", value: false } },
            { hive: "band", key: "dateTime.bandTimeZone", operation: { kind: "set", value: "Moon/Base" } },
        ] }, context())).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSetting")).toEqual([]);
        expectNoWrites();
    });

    it("uses explicit reset and preserves a valid named zone", async () => {
        await invokeResolver(updateSetting, { hive: "band", key: "dateTime.bandTimeZone", operation: { kind: "set", value: " Asia/Tokyo " }, bandPublicId }, context());
        expect(authorizationTestDb.snapshot("bandSetting")[0]?.value).toBe("Asia/Tokyo");
        await invokeResolver(updateSetting, { hive: "band", key: "dateTime.bandTimeZone", operation: { kind: "reset" }, bandPublicId }, context());
        expect(authorizationTestDb.snapshot("bandSetting")).toEqual([]);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(2);
    });

});
