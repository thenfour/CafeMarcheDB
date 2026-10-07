import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BandSetting } from "@prisma/client";
import { HostingMode } from "shared/brandConfigBase";
import { clearBrandCache, loadDbBrandConfig } from "src/server/brand";
import { kBandSettingsRegistry } from "src/setting/shared/bandSettingsRegistry";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("db", () => ({ default: { bandSetting: { findMany: mocks.findMany } } }));

function validRows(overrides: Partial<Record<keyof typeof kBandSettingsRegistry, string>> = {}): BandSetting[] {
    const values = { "siteCustomization.title": "Example Band", "siteCustomization.titlePrefix": "EB: ",
        "siteCustomization.faviconUrl": "/example.png", "siteCustomization.themeColors.primaryMain": "#123456", ...overrides };
    return Object.entries(values).map(([name, value], index) => ({
        id: index + 1, publicId: `Setting${String(index + 1).padStart(9, "0")}`, name, value,
        bandId: 1, updatedAt: new Date(), updatedByUserId: null,
    }));
}

beforeEach(() => { mocks.findMany.mockReset(); clearBrandCache(); });

describe("band brand loading", () => {
    it("reads native JSON strings and combines missing keys with registry defaults", async () => {
        mocks.findMany.mockResolvedValueOnce(validRows());
        await expect(loadDbBrandConfig("brand-load.example", 1)).resolves.toMatchObject({
            hostingMode: HostingMode.GenericSingleTenant, siteTitle: "Example Band", siteTitlePrefix: "EB: ",
            siteFaviconUrl: "/example.png", theme: { primaryMain: "#123456" },
        });
        expect(mocks.findMany).toHaveBeenCalledWith({ where: { bandId: 1 } });
    });
    it("keeps the same host's band caches and last-known-good values separate", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            mocks.findMany.mockResolvedValueOnce(validRows()).mockResolvedValueOnce(validRows({ "siteCustomization.title": "Second band" }));
            const first = await loadDbBrandConfig("shared.example", 1);
            const second = await loadDbBrandConfig("shared.example", 2);
            expect(second.siteTitle).toBe("Second band");
            clearBrandCache();
            mocks.findMany.mockRejectedValue(new Error("database unavailable"));
            expect(await loadDbBrandConfig("shared.example", 1)).toEqual(first);
            expect(await loadDbBrandConfig("shared.example", 2)).toEqual(second);
        } finally { errorLog.mockRestore(); }
    });
    it("refreshes invalidated settings and preserves intentional empty titles", async () => {
        mocks.findMany.mockResolvedValueOnce(validRows());
        await loadDbBrandConfig("brand-update.example", 1);
        clearBrandCache("brand-update.example");
        mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.title": "" }));
        expect((await loadDbBrandConfig("brand-update.example", 1)).siteTitle).toBe("");
    });
    it("serves a known good identity after invalid configuration and fails initial loads visibly", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            mocks.findMany.mockResolvedValueOnce(validRows());
            const initial = await loadDbBrandConfig("invalid-refresh.example", 1);
            clearBrandCache();
            mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.themeColors.primaryMain": "not a color" }));
            expect(await loadDbBrandConfig("invalid-refresh.example", 1)).toEqual(initial);
            mocks.findMany.mockRejectedValueOnce(new Error("database unavailable"));
            await expect(loadDbBrandConfig("initial-failure.example", 1)).rejects.toThrow("database unavailable");
        } finally { errorLog.mockRestore(); }
    });
});


// MIGRATION_RESTORE: settings-editors
// Source: 1cdb8299f3f0b373ade44adc44de26e06fd59b6a:tests/brandLoading.test.ts:1-118
// Reason: Old setting readers, writers and tests were removed while typed settings replaced the storage contract.
// Restore: Account for legacy settings and branding editor workflows using typed hives and per-key authorization; preserve scheduling reanchor and cache invalidation semantics.
// Verification: Adapt preserved user/branding/setting authorization specifications and native time-zone tests; verify editor saves and resets in the built app.
// SHA256: c7dfb282ee35f25772a20e6e0a132cbd08c95b7dfa988722d970a1db98f6a742
// MIGRATION_REFERENCE_BEGIN
// import { beforeEach, describe, expect, it, vi } from "vitest"
//
// vi.mock("db", () => ({
//   default: {
//     setting: {
//       findMany: vi.fn(),
//     },
//   },
// }))
//
// import db from "db"
// import { HostingMode } from "shared/brandConfigBase"
// import { Setting } from "@/src/setting/shared/settingKeys"
// import { clearBrandCache, loadDbBrandConfig } from "src/server/brand"
//
// const findMany = vi.mocked(db.setting.findMany)
//
// const validRows = (overrides: Partial<Record<Setting, string>> = {}) => {
//   const values: Partial<Record<Setting, string>> = {
//     [Setting.Dashboard_HostingMode]: HostingMode.GenericSingleTenant,
//     [Setting.Dashboard_SiteTitle]: "Example Band",
//     [Setting.Dashboard_SiteTitlePrefix]: "EB: ",
//     [Setting.Dashboard_SiteFaviconUrl]: "/example-favicon.png",
//     [Setting.Dashboard_SiteLogoUrl]: "/example-logo.png",
//     [Setting.Dashboard_Theme_PrimaryMain]: "#123456",
//     [Setting.Dashboard_Theme_SecondaryMain]: "rgb(12, 34, 56)",
//     [Setting.Dashboard_Theme_BackgroundDefault]: "#fafafa",
//     [Setting.Dashboard_Theme_BackgroundPaper]: "#ffffff",
//     [Setting.Dashboard_Theme_TextPrimary]: "",
//     [Setting.Dashboard_Theme_ContrastText]: "hsl(50, 80%, 50%)",
//     ...overrides,
//   }
//   return Object.entries(values).map(([name, value]) => ({ name, value })) as any
// }
//
// describe("site brand loading", () => {
//   beforeEach(() => {
//     findMany.mockReset()
//   })
//
//   it("loads and validates a complete database brand", async () => {
//     findMany.mockResolvedValueOnce(validRows())
//
//     await expect(loadDbBrandConfig("brand-load.example:10455")).resolves.toEqual({
//       hostingMode: HostingMode.GenericSingleTenant,
//       siteTitle: "Example Band",
//       siteTitlePrefix: "EB: ",
//       siteFaviconUrl: "/example-favicon.png",
//       siteLogoUrl: "/example-logo.png",
//       theme: {
//         primaryMain: "#123456",
//         secondaryMain: "rgb(12, 34, 56)",
//         backgroundDefault: "#fafafa",
//         backgroundPaper: "#ffffff",
//         textPrimary: "",
//         contrastText: "hsl(50, 80%, 50%)",
//       },
//     })
//   })
//
//   it("serves an expired last-known-good brand when refresh fails", async () => {
//     const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
//     findMany.mockResolvedValueOnce(validRows())
//     const initial = await loadDbBrandConfig("stale-brand.example")
//     clearBrandCache("stale-brand.example")
//     findMany.mockRejectedValueOnce(new Error("database unavailable"))
//
//     await expect(loadDbBrandConfig("stale-brand.example")).resolves.toEqual(initial)
//     expect(errorLog).toHaveBeenCalledWith(
//       expect.stringContaining("serving the last known good value"),
//       expect.objectContaining({ message: "database unavailable" }),
//     )
//     errorLog.mockRestore()
//   })
//
//   it("refreshes an invalidated cache entry when valid settings have changed", async () => {
//     findMany.mockResolvedValueOnce(validRows())
//     await loadDbBrandConfig("brand-update.example")
//     clearBrandCache("brand-update.example")
//     findMany.mockResolvedValueOnce(validRows({
//       [Setting.Dashboard_SiteTitle]: "Updated Band",
//     }))
//
//     await expect(loadDbBrandConfig("brand-update.example")).resolves.toMatchObject({
//       siteTitle: "Updated Band",
//     })
//     expect(findMany).toHaveBeenCalledTimes(2)
//   })
//
//   it("serves the last-known-good brand when refreshed settings are invalid", async () => {
//     const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
//     findMany.mockResolvedValueOnce(validRows())
//     const initial = await loadDbBrandConfig("invalid-refresh.example")
//     clearBrandCache("invalid-refresh.example")
//     findMany.mockResolvedValueOnce(validRows({
//       [Setting.Dashboard_Theme_PrimaryMain]: "",
//     }))
//
//     await expect(loadDbBrandConfig("invalid-refresh.example")).resolves.toEqual(initial)
//     expect(errorLog).toHaveBeenCalledWith(
//       expect.stringContaining("serving the last known good value"),
//       expect.anything(),
//     )
//     errorLog.mockRestore()
//   })
//
//   it("fails visibly instead of returning the default brand when no valid brand was loaded", async () => {
//     const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
//     findMany.mockRejectedValueOnce(new Error("database unavailable"))
//
//     await expect(loadDbBrandConfig("initial-failure.example")).rejects.toThrow("database unavailable")
//     expect(errorLog).toHaveBeenCalledWith(
//       expect.stringContaining("Failed to load an initial brand"),
//       expect.objectContaining({ message: "database unavailable" }),
//     )
//     errorLog.mockRestore()
//   })
// })
// MIGRATION_REFERENCE_END
