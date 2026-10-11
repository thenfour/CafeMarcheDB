import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { Permission, getPermissionDefinition } from "shared/permissions";
import { SiteBrandingSettingsSchema, siteBrandingSettingByField } from "shared/siteBranding";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { loadPageAuthorization } from "src/auth/server/pageRequestAuthorization";
import getPresentationData from "src/locale/queries/getPresentationData";
import { clearBrandCache } from "src/server/brand";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import updateSetting from "src/setting/server/mutations/updateSetting";
import updateBulkSettings from "src/setting/server/mutations/updateBulkSettings";
import updateSiteBrandingSettings from "src/setting/server/mutations/updateSiteBrandingSettings";
import { kBandSettingsRegistry } from "src/setting/shared/bandSettingsRegistry";
import type { SettingCommand, SettingsHive } from "src/setting/shared/settingsContract";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";
import {
    firstSettingsBand, secondSettingsBand, resetSettingsAuthorizationFixture, setSettingsBandPermissions,
    settingsAdminId, settingsOwnerId, settingsPermissionId, settingsTestContext, settingsTestDatabase, settingsTransactionFixture,
} from "../support/settingsAuthorizationFixture";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});
vi.mock("src/server/brand", () => ({ clearBrandCache: vi.fn() }));

beforeEach(() => {
    resetSettingsAuthorizationFixture();
    vi.mocked(clearBrandCache).mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

function validBranding() {
    return SiteBrandingSettingsSchema.parse(Object.fromEntries(Object.entries(siteBrandingSettingByField)
        .map(([field, key]) => [field, kBandSettingsRegistry[key].defaultValue])));
}

function set(hive: SettingsHive, key: string, value: unknown): SettingCommand {
    return { hive, key, operation: { kind: "set", value } };
}

function expectNoSettingWrites(): void {
    expect(authorizationTestDb.snapshot("bandSetting")).toEqual([]);
    expect(authorizationTestDb.snapshot("globalSetting")).toEqual([]);
    expect(authorizationTestDb.snapshot("change")).toEqual([]);
    expect(clearBrandCache).not.toHaveBeenCalled();
}

describe("BA-C001 and BA-C002 registered setting authorization", () => {
    it("admits an active account to typed settings while preserving the page and per-key boundaries", async () => {
        const ctx = settingsTestContext();
        const auth = await loadPageAuthorization("/backstage/settings", ctx.session, firstSettingsBand);
        expect(auth.hasPermission(Permission.sysadmin)).toBe(false);
        expect((await loadSettingsSnapshot(settingsTestDatabase, auth)).user["calendar.showDeclinedEvents"]?.capabilities.canEdit).toBe(true);
        expect((await loadSettingsSnapshot(settingsTestDatabase, auth)).global["global.dev.textPalette"]).toBeUndefined();
        setSettingsBandPermissions([Permission.manage_band_settings]);
        const scheduler = await loadPageAuthorization("/backstage/settings", settingsTestContext().session, firstSettingsBand);
        expect((await loadSettingsSnapshot(settingsTestDatabase, scheduler)).band["dateTime.bandTimeZone"]?.capabilities.canEdit).toBe(true);
        await expect(loadPageAuthorization("/backstage/brand", settingsTestContext().session, firstSettingsBand)).rejects.toThrow();
        await expect(loadPageAuthorization("/backstage/settings", settingsTestContext(null).session, firstSettingsBand)).rejects.toThrow();
    });
    it("registers branding as a delegable band capability", () => {
        expect(getPermissionDefinition(Permission.manage_site_branding)).toMatchObject({
            scope: "band", isDelegable: true, isProtected: false,
        });
        expect(Object.values(siteBrandingSettingByField)).toHaveLength(15);
        expect(siteBrandingSettingByField.themeTextPrimary).toBe("siteCustomization.themeColors.textPrimary");
        expect(Object.values(siteBrandingSettingByField)).not.toContain("Dashboard_HostingMode");
    });

    it("publishes all registered branding fields to only the explicit band and invalidates after commit", async () => {
        const input = { ...validBranding(), siteTitle: "First band", bandTimeZone: "Asia/Tokyo", themeTextPrimary: "#123456" };
        await expect(invokeResolver(updateSiteBrandingSettings, { ...input, bandPublicId: firstSettingsBand }, settingsTestContext())).resolves.toEqual(input);
        expect(authorizationTestDb.snapshot("bandSetting")).toHaveLength(15);
        expect(authorizationTestDb.snapshot("bandSetting").every(row => row.bandId === 1)).toBe(true);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(15);
        expect(clearBrandCache).toHaveBeenCalledOnce();
        const other = await invokeResolver(getPresentationData, { bandPublicId: secondSettingsBand }, settingsTestContext());
        expect(other.settings.band["siteCustomization.title"]?.value).toBe("Backstage");
        expect(other.settings.band["siteCustomization.themeColors.textPrimary"]?.value).toBe("");
    });

    it("lets a branding manager edit branding without granting time-zone or platform changes", async () => {
        setSettingsBandPermissions([Permission.manage_site_branding]);
        const ctx = settingsTestContext();
        await invokeResolver(updateSetting, { ...set("band", "siteCustomization.themeColors.textPrimary", ""), bandPublicId: firstSettingsBand }, ctx);
        expect(authorizationTestDb.snapshot("bandSetting")[0]?.value).toBe("");
        vi.mocked(clearBrandCache).mockClear();
        await expect(invokeResolver(updateSetting, { ...set("band", "dateTime.bandTimeZone", "Asia/Tokyo"), bandPublicId: firstSettingsBand }, ctx)).rejects.toThrow();
        await expect(invokeResolver(updateSetting, set("global", "global.ui.event.tags.selectStyle", "dialog"), ctx)).rejects.toThrow();
        expect(clearBrandCache).not.toHaveBeenCalled();
        expect(authorizationTestDb.snapshot("bandSetting")).toHaveLength(1);
    });

    it("keeps the scheduling grant separate from branding and rejects the whole unauthorized aggregate", async () => {
        setSettingsBandPermissions([Permission.manage_band_settings]);
        const ctx = settingsTestContext();
        await expect(invokeResolver(updateSiteBrandingSettings, { ...validBranding(), bandPublicId: firstSettingsBand }, ctx)).rejects.toThrow();
        expectNoSettingWrites();
        await invokeResolver(updateSetting, { ...set("band", "dateTime.bandTimeZone", "Asia/Tokyo"), bandPublicId: firstSettingsBand }, ctx);
        expect(authorizationTestDb.snapshot("bandSetting")[0]?.name).toBe("dateTime.bandTimeZone");
    });

    it("requires every aggregate key's permission even when a denied field has its default value", async () => {
        setSettingsBandPermissions([Permission.manage_site_branding]);
        await expect(invokeResolver(updateSiteBrandingSettings, { ...validBranding(), bandPublicId: firstSettingsBand }, settingsTestContext())).rejects.toThrow();
        expectNoSettingWrites();
    });

    it.each([null, secondSettingsBand])("does not borrow branding grants for context %s", async bandPublicId => {
        await expect(invokeResolver(updateSetting, { ...set("band", "siteCustomization.title", "Denied"), bandPublicId }, settingsTestContext())).rejects.toThrow();
        expectNoSettingWrites();
    });

    it("delivers public registered presentation without private settings or raw storage", async () => {
        await authorizationTestDb.getDelegate("bandSetting").create({ data: { id: 1, bandId: 1, name: "siteCustomization.title", value: "Public band title" } });
        await authorizationTestDb.getDelegate("globalSetting").create({ data: { id: 1, name: "global.dev.textPalette", value: "private palette" } });
        const data = await invokeResolver(getPresentationData, { bandPublicId: firstSettingsBand }, settingsTestContext(null));
        expect(data.settings.band["siteCustomization.title"]).toMatchObject({ value: "Public band title", capabilities: { canView: true, canEdit: false } });
        expect(data.settings.global["global.dev.textPalette"]).toBeUndefined();
        expect(data.settings.global["global.files.upload.maxImageDimension"]).toBeUndefined();
        expect(data.settings.user).toEqual({});
        expect(data.settings.bandUser).toEqual({});
        expect(data.settings.band["dateTime.bandTimeZone"]).toMatchObject({ value: "Europe/Brussels", source: "default" });
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
        expect(clearBrandCache).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "Europe/NotAPlace", "+02:00"])("validates the entire aggregate before writing an invalid time zone %j", async bandTimeZone => {
        await expect(invokeResolver(updateSiteBrandingSettings, { ...validBranding(), siteTitle: "Would change", bandTimeZone, bandPublicId: firstSettingsBand }, settingsTestContext())).rejects.toThrow();
        expectNoSettingWrites();
    });

    it.each([
        { siteFaviconUrl: "javascript:alert(1)" }, { siteLogoUrl: "//untrusted.invalid/logo.svg" },
        { themePrimaryMain: "invalid-color" }, { themeTextPrimary: "var(--text-primary)" },
        { themeTextPrimary: "#12" }, { siteTitlePrefix: "prefix too long" },
        { themePrimaryMain: " #123456 " }, { themeSecondaryMain: "RGB(12, 34, 56)" },
    ])("rejects unsafe or unusable branding before writes: %j", async invalid => {
        await expect(invokeResolver(updateSiteBrandingSettings, { ...validBranding(), ...invalid, bandPublicId: firstSettingsBand }, settingsTestContext())).rejects.toThrow();
        expectNoSettingWrites();
    });

    it.each(["Dashboard_HostingMode", "arbitrary", "__proto__"])("rejects an unknown or platform aggregate field %s", async key => {
        await expect(invokeResolver(updateSiteBrandingSettings, { ...validBranding(), [key]: "CafeMarche", bandPublicId: firstSettingsBand }, settingsTestContext())).rejects.toThrow();
        expectNoSettingWrites();
    });

    it("ignores a stale session branding grant and refreshes inside the transaction", async () => {
        const ctx = settingsTestContext(settingsOwnerId, [Permission.manage_site_branding]);
        await invokeResolver(getPresentationData, { bandPublicId: firstSettingsBand }, ctx);
        const transact = settingsTransactionFixture.transaction.bind(settingsTransactionFixture);
        vi.spyOn(settingsTransactionFixture, "transaction").mockImplementationOnce(async work => {
            setSettingsBandPermissions([]);
            return transact(work);
        });
        await expect(invokeResolver(updateSetting, { ...set("band", "siteCustomization.title", "Stale grant"), bandPublicId: firstSettingsBand }, ctx)).rejects.toThrow();
        expectNoSettingWrites();
    });

    it("refreshes platform role grants rather than trusting role-carried session Sysadmin", async () => {
        const ctx = settingsTestContext(settingsAdminId, [Permission.sysadmin, Permission.manage_global_settings]);
        await invokeResolver(getPresentationData, {}, ctx);
        const transact = settingsTransactionFixture.transaction.bind(settingsTransactionFixture);
        vi.spyOn(settingsTransactionFixture, "transaction").mockImplementationOnce(async work => {
            await authorizationTestDb.getDelegate("globalRole").update({ where: { id: 30 }, data: { isDeleted: true } });
            return transact(work);
        });
        await expect(invokeResolver(updateSetting, set("global", "global.dev.textPalette", "Denied"), ctx)).rejects.toThrow();
        expectNoSettingWrites();
    });

    it("allows a freshly verified platform role without requiring the legacy isSysAdmin flag", async () => {
        const ctx = settingsTestContext(settingsAdminId);
        const commands = [set("global", "global.ui.event.tags.selectStyle", "dialog"), set("global", "global.dev.textPalette", "palette")];
        await invokeResolver(updateBulkSettings, { commands }, ctx);
        const data = await invokeResolver(getPresentationData, {}, ctx);
        expect(data.settings.global["global.dev.textPalette"]).toMatchObject({ value: "palette", capabilities: { canView: true, canEdit: true } });
        expect(data.settings.global["global.ui.event.tags.selectStyle"]?.value).toBe("dialog");
        expect(data.authorization.effectivePermissionNames).toContain(Permission.sysadmin);
        expect(authorizationTestDb.snapshot("user").find(user => user.id === settingsAdminId)?.isSysAdmin).toBe(false);
        expect(clearBrandCache).toHaveBeenCalledOnce();
    });

    it("requires a key's read capability as well as its write capability", async () => {
        await authorizationTestDb.getDelegate("globalRolePermission").deleteMany({ where: { permissionId: settingsPermissionId(Permission.sysadmin) } });
        await authorizationTestDb.getDelegate("globalRole").update({ where: { id: 30 }, data: { isSysAdminRole: false } });
        await expect(invokeResolver(updateSetting, set("global", "global.dev.textPalette", "Hidden"), settingsTestContext(settingsAdminId))).rejects.toThrow();
        expectNoSettingWrites();
        await invokeResolver(updateSetting, set("global", "global.ui.event.tags.selectStyle", "dialog"), settingsTestContext(settingsAdminId));
    });

    it("rolls back earlier aggregate fields and audits without invalidating the cache when a write fails", async () => {
        const failure = new Error("Branding commit failed");
        vi.spyOn(authorizationTestDb.getDelegate("change"), "create").mockImplementationOnce(async () => {
            throw failure;
        });
        await expect(invokeResolver(updateSiteBrandingSettings, { ...validBranding(), bandPublicId: firstSettingsBand }, settingsTestContext())).rejects.toBe(failure);
        expectNoSettingWrites();
    });

    it.each(["Setting", "GlobalSetting", "BandSetting", "UserSetting", "BandUserSetting"])("keeps %s outside generic DB3 even for platform administrators", async tableID => {
        const auth = await loadAuthorizationForUser({ id: settingsAdminId }, settingsTestDatabase);
        expect(auth.hasPermission(Permission.sysadmin)).toBe(true);
        expect(() => db3.GetTableById(tableID)).toThrow("was not found");
        expect(() => db3.getDB3View(`${tableID}_Editor`)).toThrow("was not found");
        expect((await loadSettingsSnapshot(settingsTestDatabase, auth)).band).toEqual({});
    });
});
