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
        id: index + 1, publicId: `Setting${String(index + 1).padStart(9, "0")}`, name, value: JSON.stringify(value),
        bandId: 1, updatedAt: new Date(), updatedByUserId: null,
    }));
}

beforeEach(() => { mocks.findMany.mockReset(); clearBrandCache(); });

describe("band brand loading", () => {
    it("decodes migrated JSON text and combines missing keys with registry defaults", async () => {
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
