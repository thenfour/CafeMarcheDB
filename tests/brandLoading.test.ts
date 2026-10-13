import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BandSetting } from "@prisma/client";
import { HostingMode } from "shared/brandConfigBase";
import { clearBrandCache, loadDbBrandConfig } from "src/server/brand";
import { kBandSettingsRegistry } from "src/setting/shared/bandSettingsRegistry";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("db", () => ({ default: { bandSetting: { findMany: mocks.findMany } } }));

function validRows(overrides: Partial<Record<keyof typeof kBandSettingsRegistry, string>> = {}): BandSetting[] {
    const values = { "siteCustomization.title": "Example Band", "siteCustomization.titlePrefix": "EB: ",
        "siteCustomization.faviconUrl": "/example.png", "siteCustomization.logoUrl": "/example-logo.svg",
        "siteCustomization.themeColors.primaryMain": "#123456", ...overrides };
    return Object.entries(values).map(([name, value], index) => ({
        id: index + 1, publicId: `Setting${String(index + 1).padStart(9, "0")}`, name, value,
        bandId: 1, updatedAt: new Date(), updatedByUserId: null,
    }));
}

beforeEach(() => { mocks.findMany.mockReset(); clearBrandCache(); });

describe("band brand loading", () => {
    it("reads native JSON strings and combines missing keys with registry defaults", async () => {
        mocks.findMany.mockResolvedValueOnce(validRows());
        await expect(loadDbBrandConfig({ hostHeader: "brand-load.example", bandId: 1, freshness: "cached" })).resolves.toMatchObject({
            hostingMode: HostingMode.Platform, siteTitle: "Example Band", siteTitlePrefix: "EB: ",
            siteFaviconUrl: "/example.png", siteLogoUrl: "/example-logo.svg", theme: { primaryMain: "#123456" },
        });
        expect(mocks.findMany).toHaveBeenCalledWith({ where: { bandId: 1 } });
    });
    it("publishes optional primary text color, clears it, and uses the theme when its row is absent", async () => {
        const scope = { hostHeader: "optional-text.example", bandId: 1 };
        mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.themeColors.textPrimary": "#123456" }));
        expect((await loadDbBrandConfig({ ...scope, freshness: "refresh" })).theme?.textPrimary).toBe("#123456");
        mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.themeColors.textPrimary": "" }));
        expect((await loadDbBrandConfig({ ...scope, freshness: "refresh" })).theme?.textPrimary).toBeUndefined();
        mocks.findMany.mockResolvedValueOnce(validRows());
        expect((await loadDbBrandConfig({ ...scope, freshness: "refresh" })).theme?.textPrimary).toBeUndefined();
    });
    it("serves the last known good color when an expired cache cannot refresh", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
        try {
            mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.themeColors.textPrimary": "rgb(12, 34, 56)" }));
            const scope = { hostHeader: "expired-brand.example", bandId: 1, freshness: "cached" as const };
            const initial = await loadDbBrandConfig(scope);
            expect(await loadDbBrandConfig(scope)).toEqual(initial);
            expect(mocks.findMany).toHaveBeenCalledOnce();
            now.mockReturnValue(120_000);
            mocks.findMany.mockRejectedValueOnce(new Error("database unavailable"));
            expect(await loadDbBrandConfig(scope)).toEqual(initial);
            expect(mocks.findMany).toHaveBeenCalledTimes(2);
        } finally {
            now.mockRestore();
            errorLog.mockRestore();
        }
    });
    it("keeps the same host's band caches and last-known-good values separate", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            mocks.findMany.mockResolvedValueOnce(validRows()).mockResolvedValueOnce(validRows({ "siteCustomization.title": "Second band", "siteCustomization.logoUrl": "/second-logo.png" }));
            const first = await loadDbBrandConfig({ hostHeader: "shared.example", bandId: 1, freshness: "cached" });
            const second = await loadDbBrandConfig({ hostHeader: "shared.example", bandId: 2, freshness: "cached" });
            expect(second.siteTitle).toBe("Second band");
            expect(first.siteLogoUrl).toBe("/example-logo.svg");
            expect(second.siteLogoUrl).toBe("/second-logo.png");
            clearBrandCache();
            mocks.findMany.mockRejectedValue(new Error("database unavailable"));
            expect(await loadDbBrandConfig({ hostHeader: "shared.example", bandId: 1, freshness: "cached" })).toEqual(first);
            expect(await loadDbBrandConfig({ hostHeader: "shared.example", bandId: 2, freshness: "cached" })).toEqual(second);
        } finally { errorLog.mockRestore(); }
    });
    it("refreshes invalidated settings and preserves intentional empty titles", async () => {
        mocks.findMany.mockResolvedValueOnce(validRows());
        await loadDbBrandConfig({ hostHeader: "brand-update.example", bandId: 1, freshness: "cached" });
        clearBrandCache("brand-update.example");
        mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.title": "", "siteCustomization.logoUrl": "" }));
        expect(await loadDbBrandConfig({ hostHeader: "brand-update.example", bandId: 1, freshness: "cached" })).toMatchObject({ siteTitle: "", siteLogoUrl: "" });
    });
    it("refreshes committed identity and image URLs even when another server bundle still has a valid cache", async () => {
        const scope = { hostHeader: "brand-publication.example", bandId: 1 };
        mocks.findMany.mockResolvedValueOnce(validRows());
        const initial = await loadDbBrandConfig({ ...scope, freshness: "cached" });
        expect(await loadDbBrandConfig({ ...scope, freshness: "cached" })).toEqual(initial);
        expect(mocks.findMany).toHaveBeenCalledOnce();
        mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.title": "Published title",
            "siteCustomization.faviconUrl": "/api/files/download/new.png?bandPublicId=Brand0000000001",
            "siteCustomization.logoUrl": "/api/files/download/new.svg?bandPublicId=Brand0000000001" }));
        expect(await loadDbBrandConfig({ ...scope, freshness: "refresh" })).toMatchObject({ siteTitle: "Published title",
            siteFaviconUrl: "/api/files/download/new.png?bandPublicId=Brand0000000001",
            siteLogoUrl: "/api/files/download/new.svg?bandPublicId=Brand0000000001" });
        expect(mocks.findMany).toHaveBeenCalledTimes(2);
    });
    it("serves a known good identity after invalid configuration and fails initial loads visibly", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            mocks.findMany.mockResolvedValueOnce(validRows());
            const initial = await loadDbBrandConfig({ hostHeader: "invalid-refresh.example", bandId: 1, freshness: "cached" });
            clearBrandCache();
            mocks.findMany.mockResolvedValueOnce(validRows({ "siteCustomization.themeColors.primaryMain": "not a color" }));
            expect(await loadDbBrandConfig({ hostHeader: "invalid-refresh.example", bandId: 1, freshness: "cached" })).toEqual(initial);
            mocks.findMany.mockRejectedValueOnce(new Error("database unavailable"));
            await expect(loadDbBrandConfig({ hostHeader: "initial-failure.example", bandId: 1, freshness: "cached" })).rejects.toThrow("database unavailable");
        } finally { errorLog.mockRestore(); }
    });
});
