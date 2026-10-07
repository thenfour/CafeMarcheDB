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


// MIGRATION_RESTORE: settings-editors
// Source: 1cdb8299f3f0b373ade44adc44de26e06fd59b6a:tests/datetime/bandTimeZoneWrites.test.ts:1-200
// Reason: Old setting readers, writers and tests were removed while typed settings replaced the storage contract.
// Restore: Account for legacy settings and branding editor workflows using typed hives and per-key authorization; preserve scheduling reanchor and cache invalidation semantics.
// Verification: Adapt preserved user/branding/setting authorization specifications and native time-zone tests; verify editor saves and resets in the built app.
// SHA256: d768fc49a5640e3299acd219592fff7413b271a0ee099d07e01e8534c1c56812
// MIGRATION_REFERENCE_BEGIN
// import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
//
// vi.mock("db", async () => {
//   const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client")
//   const { authorizationTestDb } = await import("../authorization/support/inMemoryPrisma")
//   return { ...prisma, default: authorizationTestDb }
// })
//
// vi.mock("src/server/brand", () => ({ clearBrandCache: vi.fn() }))
//
// import db3Mutation from "tests/authorization/db3MutationTestResolver"
// import updateSetting from "@/src/setting/server/mutations/updateSetting"
// import { clearBrandCache } from "src/server/brand"
// import { Permission } from "shared/permissions"
// import { Setting } from "@/src/setting/shared/settingKeys"
// import { authorizationTestDb } from "../authorization/support/inMemoryPrisma"
// import { createAuthorizationPersona, createAuthorizationTestUser } from "../authorization/support/authorizationFixtures"
// import { forgeDb3Insert, forgeDb3PublicUpdate } from "../authorization/support/db3RequestBuilders"
// import { invokeResolver } from "../authorization/support/resolverHarness"
// import { loadBandTimeZone } from "@/src/server/bandTimeZone"
// import updateBulkSettings from "@/src/setting/server/mutations/updateBulkSettings"
//
// const sysadmin = createAuthorizationTestUser("sysadmin", { id: 710 })
// const adminContext = () => createAuthorizationPersona("sysadmin", { id: sysadmin.id }).ctx
// const originalSetting = { id: 1, publicId: "SettingPublic001", name: Setting.BandTimeZone, value: "Europe/Brussels" }
//
// function expectNoWrites() {
//   expect(authorizationTestDb.snapshot("change")).toEqual([])
//   expect(clearBrandCache).not.toHaveBeenCalled()
// }
//
// beforeEach(() => {
//   authorizationTestDb.reset({ user: [sysadmin], setting: [originalSetting], change: [] })
//   vi.mocked(clearBrandCache).mockClear()
//   vi.spyOn(console, "error").mockImplementation(() => undefined)
// })
//
// afterEach(() => { vi.restoreAllMocks() })
//
// describe("band timezone validation in generic setting mutations", () => {
//   it.each(["Moon/Base", "+02:00", "2026-07-10T09:45+02:00"])("rejects %s before updating an existing setting", async value => {
//     await expect(invokeResolver(updateSetting, { name: Setting.BandTimeZone, value }, adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([originalSetting])
//     expectNoWrites()
//   })
//
//   it("also validates creation through the generic setting mutation", async () => {
//     authorizationTestDb.getDelegate("setting").reset([])
//     await expect(invokeResolver(updateSetting, {
//       name: Setting.BandTimeZone, value: "Moon/Base",
//     }, adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([])
//     expectNoWrites()
//   })
//
//   it("rejects an invalid band timezone in a bulk request", async () => {
//     // The in-memory transaction harness does not emulate database rollback.
//     // Put the rejected row first to verify this entry point before any writes.
//     await expect(invokeResolver(updateBulkSettings, [
//       { name: Setting.BandTimeZone, value: "Moon/Base" },
//       { name: "UnrelatedSetting", value: "anything" },
//     ], adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([originalSetting])
//     expectNoWrites()
//   })
//
//   it.each(["bandtimezone", "BANDTIMEZONE", "BandTimeZone "])("validates a case-equivalent or padded key %j", async name => {
//     await expect(invokeResolver(updateSetting, { name, value: "Moon/Base" }, adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([originalSetting])
//     expectNoWrites()
//   })
//
//   it("validates the actual retrieved row when database collation matches another spelling", async () => {
//     vi.spyOn(authorizationTestDb.getDelegate("setting"), "findFirst").mockResolvedValue(originalSetting)
//     await expect(invokeResolver(updateSetting, {
//       name: "BandTimeZon\u00e9", value: "Moon/Base",
//     }, adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([originalSetting])
//     expectNoWrites()
//   })
//
//   it.each([null, ""])("preserves clearing the setting with %j and restores the default", async value => {
//     await invokeResolver(updateSetting, { name: Setting.BandTimeZone, value }, adminContext())
//     expect(authorizationTestDb.snapshot("setting")).toEqual([])
//     await expect(loadBandTimeZone()).resolves.toBe("Europe/Brussels")
//   })
//
//   it("preserves whitespace as an unset value at the generic storage boundary", async () => {
//     await invokeResolver(updateSetting, { name: Setting.BandTimeZone, value: "   " }, adminContext())
//     expect(authorizationTestDb.snapshot("setting")).toEqual([{ ...originalSetting, value: "   " }])
//     await expect(loadBandTimeZone()).resolves.toBe("Europe/Brussels")
//   })
//
//   it("accepts a valid named zone without restricting unrelated setting values", async () => {
//     await invokeResolver(updateBulkSettings, [
//       { name: Setting.BandTimeZone, value: "Asia/Tokyo" },
//       { name: "UnrelatedSetting", value: "not a timezone" },
//     ], adminContext())
//     await expect(loadBandTimeZone()).resolves.toBe("Asia/Tokyo")
//     expect(authorizationTestDb.snapshot("setting")).toEqual([
//       { ...originalSetting, value: "Asia/Tokyo" },
//       expect.objectContaining({ id: 2, publicId: expect.any(String), name: "UnrelatedSetting", value: "not a timezone" }),
//     ])
//   })
// })
//
// describe("band timezone validation in the raw DB3 setting editor", () => {
//   it("rejects an invalid inserted timezone before creating the setting or activity log", async () => {
//     authorizationTestDb.getDelegate("setting").reset([])
//     await expect(invokeResolver(db3Mutation, forgeDb3Insert("Setting", {
//       name: Setting.BandTimeZone, value: "Moon/Base",
//     }), adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([])
//     expectNoWrites()
//   })
//
//   it.each(["Asia/Tokyo", ""])("accepts an inserted zone or unset value %j", async value => {
//     authorizationTestDb.getDelegate("setting").reset([])
//     await invokeResolver(db3Mutation, forgeDb3Insert("Setting", {
//       name: Setting.BandTimeZone, value,
//     }), adminContext())
//     await expect(loadBandTimeZone()).resolves.toBe(value || "Europe/Brussels")
//   })
//
//   it("checks the persisted name during a value-only update", async () => {
//     await expect(invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, {
//       value: "Moon/Base",
//     }), adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([originalSetting])
//     expectNoWrites()
//   })
//
//   it("checks the persisted value when renaming another setting to BandTimeZone", async () => {
//     const otherSetting = { ...originalSetting, name: "UnrelatedSetting", value: "not a timezone" }
//     authorizationTestDb.getDelegate("setting").reset([otherSetting])
//     await expect(invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, {
//       name: Setting.BandTimeZone,
//     }), adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([otherSetting])
//     expectNoWrites()
//   })
//
//   it("accepts a name-only rename whose persisted value is a valid timezone", async () => {
//     authorizationTestDb.getDelegate("setting").reset([{ ...originalSetting, name: "UnrelatedSetting", value: "Asia/Tokyo" }])
//     await invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, { name: Setting.BandTimeZone }), adminContext())
//     await expect(loadBandTimeZone()).resolves.toBe("Asia/Tokyo")
//   })
//
//   it("validates the resulting name and value when both are changed", async () => {
//     authorizationTestDb.getDelegate("setting").reset([{ ...originalSetting, name: "UnrelatedSetting", value: "not a timezone" }])
//     await invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, {
//       name: Setting.BandTimeZone, value: "America/Los_Angeles",
//     }), adminContext())
//     await expect(loadBandTimeZone()).resolves.toBe("America/Los_Angeles")
//   })
//
//   it("allows a malformed legacy setting to be repaired with a value-only update", async () => {
//     authorizationTestDb.getDelegate("setting").reset([{ ...originalSetting, value: "Moon/Base" }])
//     await invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, { value: "Asia/Tokyo" }), adminContext())
//     await expect(loadBandTimeZone()).resolves.toBe("Asia/Tokyo")
//   })
//
//   it("allows renaming a malformed legacy setting away from BandTimeZone", async () => {
//     authorizationTestDb.getDelegate("setting").reset([{ ...originalSetting, value: "Moon/Base" }])
//     await invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, { name: "UnrelatedSetting" }), adminContext())
//     await expect(loadBandTimeZone()).resolves.toBe("Europe/Brussels")
//     expect(authorizationTestDb.snapshot("setting")).toEqual([{ ...originalSetting, name: "UnrelatedSetting", value: "Moon/Base" }])
//   })
//
//   it("preserves an empty stored value as the default timezone", async () => {
//     await invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, { value: "" }), adminContext())
//     expect(authorizationTestDb.snapshot("setting")).toEqual([{ ...originalSetting, value: "" }])
//     await expect(loadBandTimeZone()).resolves.toBe("Europe/Brussels")
//   })
//
//   it("checks case-equivalent keys in a value-only update", async () => {
//     const setting = { ...originalSetting, name: "bandtimezone" }
//     authorizationTestDb.getDelegate("setting").reset([setting])
//     await expect(invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, {
//       value: "Moon/Base",
//     }), adminContext())).rejects.toThrow()
//     expect(authorizationTestDb.snapshot("setting")).toEqual([setting])
//     expectNoWrites()
//   })
// })
//
// it("keeps generic write paths restricted to sysadmins even for branding managers", async () => {
//   const permissions = [Permission.login, Permission.manage_site_branding]
//   const manager = createAuthorizationTestUser("normal", { id: 711, permissions })
//   authorizationTestDb.reset({ user: [manager], setting: [originalSetting], change: [] })
//   const { ctx } = createAuthorizationPersona("normal", { id: manager.id, permissions })
//   await expect(invokeResolver(updateSetting, {
//     name: Setting.BandTimeZone, value: "Asia/Tokyo",
//   }, ctx)).rejects.toThrow()
//   await expect(invokeResolver(db3Mutation, forgeDb3PublicUpdate("Setting", originalSetting.publicId, {
//     value: "Asia/Tokyo",
//   }), ctx)).rejects.toThrow()
//   expect(authorizationTestDb.snapshot("setting")).toEqual([originalSetting])
//   expectNoWrites()
// })
// MIGRATION_REFERENCE_END
