import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission, gPermissionRegistry } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { createLocaleApi } from "src/locale/shared/localizationCatalog";
import { presentationContextKey } from "src/locale/shared/presentationContext";
import { loadLocalizationCatalog, lookupStaticTranslation, resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import { loadSettingsSnapshot, writeSettings } from "src/setting/server/settings";
import { validateSettingValue, readSettingSnapshot, SettingCommandSchema, type SettingCommand } from "src/setting/shared/settingsContract";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";
import updateSetting from "src/setting/server/mutations/updateSetting";
import updateBulkSettings from "src/setting/server/mutations/updateBulkSettings";
import getPresentationData from "src/locale/queries/getPresentationData";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./authorization/support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});
vi.mock("src/server/brand", () => ({ clearBrandCache: vi.fn() }));

// The fake implements the Prisma queries needed by these integration checks.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;
const user = { id: 42, publicId: "User000000000042", globalRoleId: 31, isDeleted: false, mergedIntoUserId: null, isSysAdmin: false };
const outsider = { ...user, id: 43, publicId: "User000000000043" };
const bandA = parsePublicId<"Band">("Band000000000001");
const bandB = parsePublicId<"Band">("Band000000000002");
const permissionId = (key: Permission) => gPermissionRegistry.findIndex(entry => entry.key === key) + 1;
const valueRow = (id: number, localeId: number, indexedValue: string, extra: { stringKey?: string; stringId?: number; bandId?: number } = {}) =>
    ({ id, publicId: `Value${String(id).padStart(11, "0")}`, localeId, indexedValue, blobValue: null, updatedAt: new Date(0), ...extra });
const key = "common.action.ok";
const command = (hive: SettingCommand["hive"], key: string, value: unknown): SettingCommand => ({ hive, key, operation: { kind: "set", value } });

beforeEach(() => authorizationTestDb.reset({
    user: [user, outsider],
    band: [1, 2].map(id => ({ id, publicId: `Band00000000000${id}`, isDeleted: false })),
    bandUser: [1, 2].map(id => ({ id, publicId: `Member000000000${id}`, bandId: id, userId: 42, bandRoleId: id + 10, isDeleted: false })),
    bandRole: [{ id: 1, isPublicRole: true, isDeleted: false }, { id: 11, isDeleted: false }, { id: 12, isDeleted: false }],
    globalRole: [{ id: 30, isSysAdminRole: true, isDeleted: false }, { id: 31, isDeleted: false }, { id: 32, isPublicRole: true, isDeleted: false }],
    permission: gPermissionRegistry.map((definition, index) => ({ id: index + 1, name: definition.key, isDeleted: false })),
    bandRolePermission: [Permission.manage_band_settings, Permission.manage_site_branding, Permission.manage_band_localization]
        .map((key, index) => ({ id: index + 1, bandRoleId: 11, permissionId: permissionId(key) })),
    globalRolePermission: [
        ...[Permission.manage_global_settings, Permission.manage_global_localization, Permission.sysadmin]
            .map((key, index) => ({ id: index + 1, globalRoleId: 30, permissionId: permissionId(key) })),
        { id: 10, globalRoleId: 31, permissionId: permissionId(Permission.login) },
    ],
    locale: ["en-US", "fr-BE", "nl-BE"].map((ietfTag, index) => ({ id: index + 1, publicId: `Locale000000000${index + 1}`, ietfTag, isDeleted: false })),
    bandLocale: [1, 2].flatMap(bandId => [1, 2, 3].map(localeId => ({ id: bandId * 10 + localeId, bandId, localeId }))),
    staticLocalizedStringValue: [valueRow(1, 3, "Global Dutch", { stringKey: key })],
    bandStaticLocalizedStringValue: [valueRow(2, 2, "Band French", { bandId: 1, stringKey: key })],
    dynamicLocalizedStringValue: [valueRow(3, 3, "Dynamic Dutch", { stringId: 1 }), valueRow(4, 1, "Other", { stringId: 2 })],
    bandDynamicLocalizedStringValue: [valueRow(5, 2, "Dynamic French", { bandId: 1, stringId: 1 })],
    bandSetting: [{ id: 1, publicId: "Setting000000001", bandId: 2, name: "siteCustomization.title", value: "Other band" }],
    userSetting: [{ id: 1, userId: 43, name: "calendar.showDeclinedEvents", value: false }],
    bandUserSetting: [{ id: 1, bandUserId: 2, name: "calendar.locale", value: "nl-BE" }],
}));

async function writeCommands(commands: SettingCommand[], bandPublicId: typeof bandA = bandA, principal = user) {
    const auth = await loadAuthorizationForUser(principal, database, bandPublicId);
    return authorizationTestDb.transaction(() => writeSettings(database, auth, commands, CreateChangeContext("phase2-test")));
}

describe("authorized catalog delivery", () => {
    it("formats static menu captions with the current band name, including translated captions", async () => {
        await database.bandStaticLocalizedStringValue.create({ data: {
            publicId: "Value000000000006", bandId: 1, localeId: 2,
            stringKey: "menu.events", indexedValue: "Concerts de {bandName}", blobValue: null,
        } });
        const auth = await loadAuthorizationForUser(user, database, bandA);
        const catalog = await loadLocalizationCatalog(database, auth, { routeLocale: "fr-BE" });
        const locale = createLocaleApi(catalog);
        const parameters = { bandName: "Café Marché" };
        expect(locale.getPlainString("menu.profile", parameters)).toBe("Your Café Marché Profile");
        expect(locale.getPlainString("menu.events", parameters)).toBe("Concerts de Café Marché");
        expect(locale.getPlainString("menu.platform-profile", parameters)).toBe("Your CMDB profile");
        expect(locale.getPlainString("menu.profile", { bandName: "Second band" })).toBe("Your Second band Profile");
    });

    it("delivers a complete synchronous catalog and shares per-string policy with batched dynamic values", async () => {
        const auth = await loadAuthorizationForUser(user, database, bandA);
        const input = { browserLanguages: ["nl-BE"] };
        const catalog = await loadLocalizationCatalog(database, auth, input);
        const locale = createLocaleApi(catalog);
        expect(locale.getPlainString(key)).toBe("Band French");
        expect(locale.getPlainString("common.action.cancel")).toBe("Cancel");
        expect(locale.getPlainString("common.items.count", { count: 2 })).toBe("2 items");
        expect(locale.getPlainString("common.items.count", { count: 1 })).toBe("1 item");
        const frenchFormatting = createLocaleApi({ ...catalog, formattingLocale: "fr-BE" });
        expect(frenchFormatting.getPlainString("common.items.count", { count: 1234 })).toBe(`${new Intl.NumberFormat("fr-BE").format(1234)} items`);
        expect(locale.getMarkdownString("instrumentList_markdown")).toBe("");
        const dynamic = await resolveAuthorizedDynamicStrings(database, auth, [1, 2], input);
        expect(dynamic.get(1)?.value).toBe("Dynamic French");
        expect(dynamic.get(2)?.value).toBe("Other");
        expect(catalog.payloadBytes).toBeGreaterThan(100);
        const otherAuth = await loadAuthorizationForUser(user, database, bandB);
        expect((await loadLocalizationCatalog(database, otherAuth, input)).strings[key]?.value).toBe("Global Dutch");
    });
    it("looks up exact scope/locale for authorized editors without display fallbacks", async () => {
        const auth = await loadAuthorizationForUser(user, database, bandA);
        expect(await lookupStaticTranslation(database, auth, key, "nl-BE", "band")).toBeNull();
        expect(await lookupStaticTranslation(database, auth, key, "fr-BE", "band")).toBe("Band French");
        await expect(lookupStaticTranslation(database, auth, key, "nl-BE", "global")).rejects.toThrow();
        const other = await loadAuthorizationForUser(user, database, bandB);
        await expect(lookupStaticTranslation(database, other, key, "fr-BE", "band")).rejects.toThrow();
    });
    it("retains unavailable override provenance after disabling or deleting a locale", async () => {
        const auth = await loadAuthorizationForUser(user, database, bandA);
        await authorizationTestDb.getDelegate("bandLocale").deleteMany({ where: { bandId: 1, localeId: 2 } });
        expect((await loadLocalizationCatalog(database, auth)).strings[key]).toMatchObject({ value: null, reason: "unavailable-override" });
        await authorizationTestDb.getDelegate("locale").update({ where: { id: 2 }, data: { isDeleted: true } });
        expect((await loadLocalizationCatalog(database, auth)).strings[key]?.value).toBeNull();
    });
    it("restricts global stored translations to the band's enabled locales too", async () => {
        const auth = await loadAuthorizationForUser(user, database, bandB);
        await authorizationTestDb.getDelegate("bandLocale").deleteMany({ where: { bandId: 2, localeId: 3 } });
        expect((await loadLocalizationCatalog(database, auth, { browserLanguages: ["nl-BE"] })).strings[key])
            .toMatchObject({ value: "OK", source: "registry" });
        expect((await resolveAuthorizedDynamicStrings(database, auth, [1], { browserLanguages: ["nl-BE"] })).get(1)?.value).toBeNull();
    });
    it("partitions revisions by preferences, band, translation/availability edits and grant changes", async () => {
        const auth = await loadAuthorizationForUser(user, database, bandA);
        const input = { routeLocale: "de-DE", browserLanguages: ["nl-BE"] };
        const catalog = await loadLocalizationCatalog(database, auth, input);
        const different = await loadLocalizationCatalog(database, auth, { ...input, browserLanguages: ["fr-BE"] });
        expect(catalog.formattingLocale).toBe(different.formattingLocale);
        expect(catalog.cacheKey).not.toBe(different.cacheKey);
        expect(presentationContextKey(input)).not.toBe(presentationContextKey({ ...input, browserLanguages: ["fr-BE"] }));
        await authorizationTestDb.getDelegate("bandStaticLocalizedStringValue").update({ where: { id: 2 }, data: { indexedValue: "Changed" } });
        expect((await loadLocalizationCatalog(database, auth, input)).cacheKey).not.toBe(catalog.cacheKey);
        await authorizationTestDb.getDelegate("bandUser").update({ where: { id: 1 }, data: { isDeleted: true } });
        const offboarded = await auth.refresh(database);
        expect((await loadLocalizationCatalog(database, offboarded, input)).cacheKey).not.toBe(catalog.cacheKey);
    });
});

describe("four independent settings hives", () => {
    it("returns typed defaults and hides other users, bands and protected keys", async () => {
        const auth = await loadAuthorizationForUser(user, database, bandA);
        const settings = await loadSettingsSnapshot(database, auth);
        expect(readSettingSnapshot(settings, "band", "siteCustomization.title")).toBe("Backstage");
        expect(readSettingSnapshot(settings, "user", "calendar.showDeclinedEvents")).toBe(true);
        expect(readSettingSnapshot(settings, "bandUser", "calendar.locale")).toBe("en-US");
        expect(settings.global["global.dev.textPalette"]).toBeUndefined();
        expect(settings.band["siteCustomization.title"]?.capabilities.canEdit).toBe(true);
    });
    it("stores falsy values, audits changes, and resets explicitly", async () => {
        await writeCommands([command("band", "siteCustomization.title", ""), command("user", "calendar.showDeclinedEvents", false)]);
        let auth = await loadAuthorizationForUser(user, database, bandA);
        let settings = await loadSettingsSnapshot(database, auth);
        expect(readSettingSnapshot(settings, "band", "siteCustomization.title")).toBe("");
        expect(readSettingSnapshot(settings, "user", "calendar.showDeclinedEvents")).toBe(false);
        expect(authorizationTestDb.snapshot("bandSetting").find(row => row.bandId === 1)?.value).toBe("");
        expect(authorizationTestDb.snapshot("userSetting").find(row => row.userId === 42)?.value).toBe(false);
        await writeCommands([command("band", "siteCustomization.title", ""), command("user", "calendar.showDeclinedEvents", false)]);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(2);
        await writeCommands([{ hive: "band", key: "siteCustomization.title", operation: { kind: "reset" } }]);
        auth = await auth.refresh(database);
        settings = await loadSettingsSnapshot(database, auth);
        expect(settings.band["siteCustomization.title"]?.source).toBe("default");
        expect(authorizationTestDb.snapshot("change").map(row => row.action)).toEqual(["insert", "insert", "delete"]);
        expect(authorizationTestDb.snapshot("bandSetting")).toHaveLength(1);
    });
    it("requires active self membership for membership settings and keeps both bands independent", async () => {
        await writeCommands([command("bandUser", "calendar.locale", "fr-be")]);
        const other = await loadAuthorizationForUser(user, database, bandB);
        expect(readSettingSnapshot(await loadSettingsSnapshot(database, other), "bandUser", "calendar.locale")).toBe("nl-BE");
        await writeCommands([command("bandUser", "calendar.locale", "en-US")], bandB);
        expect(authorizationTestDb.snapshot("bandUserSetting").find(row => row.bandUserId === 1)?.value).toBe("fr-BE");
        await expect(writeCommands([command("bandUser", "calendar.locale", "fr-BE")], bandA, outsider)).rejects.toThrow();
        await authorizationTestDb.getDelegate("bandUser").update({ where: { id: 1 }, data: { isDeleted: true } });
        await expect(writeCommands([command("bandUser", "calendar.locale", "fr-BE")])).rejects.toThrow();
    });
    it("rejects cross-band grants, unknown keys, wrong types, and invalid batches before writing", async () => {
        await expect(writeCommands([command("band", "siteCustomization.title", "Denied")], bandB)).rejects.toThrow();
        await expect(writeCommands([command("global", "global.ui.event.tags.selectStyle", "dialog")])).rejects.toThrow();
        await expect(writeCommands([command("band", "arbitrary", "Bad")])).rejects.toThrow("Unknown");
        await expect(writeCommands([command("band", "siteCustomization.title", "Would write"), command("user", "calendar.showDeclinedEvents", "false")])).rejects.toThrow();
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
        expect(authorizationTestDb.snapshot("bandSetting")).toHaveLength(1);
    });
    it("writes global settings only with a freshly verified platform grant", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { globalRoleId: 30 } });
        await writeCommands([command("global", "global.ui.event.tags.selectStyle", "dialog")]);
        expect(authorizationTestDb.snapshot("globalSetting")[0]?.value).toBe("dialog");
        const auth = await loadAuthorizationForUser(user, database);
        expect(readSettingSnapshot(await loadSettingsSnapshot(database, auth), "global", "global.ui.event.tags.selectStyle")).toBe("dialog");
    });
    it("validates native JSON without decoding strings", () => {
        expect(validateSettingValue("band", "siteCustomization.title", "123")).toBe("123");
        expect(validateSettingValue("user", "calendar.showDeclinedEvents", false)).toBe(false);
        expect(() => validateSettingValue("user", "calendar.showDeclinedEvents", "false")).toThrow();
        expect(validateSettingValue("band", "siteCustomization.title", "false")).toBe("false");
        expect(() => validateSettingValue("band", "siteCustomization.title", false)).toThrow();
        expect(SettingCommandSchema.safeParse({ ...command("user", "calendar.showDeclinedEvents", false), userId: 43 }).success).toBe(false);
    });
    it("reanchors only the active band's all-day events and resets to its registry default", async () => {
        await authorizationTestDb.getDelegate("event").create({ data: { id: 1, bandId: 1 } });
        await authorizationTestDb.getDelegate("event").create({ data: { id: 2, bandId: 2 } });
        for (const eventId of [1, 2]) await authorizationTestDb.getDelegate("eventSegment").create({ data: {
            id: eventId, eventId, startsAt: new Date("2026-10-04T22:00:00Z"), durationMillis: BigInt(86_400_000), isAllDay: true, statusId: null,
        } });
        await writeCommands([command("band", "dateTime.bandTimeZone", "Asia/Tokyo")]);
        expect(await loadBandTimeZone(database, 1)).toBe("Asia/Tokyo");
        expect(await loadBandTimeZone(database, 2)).toBe("Europe/Brussels");
        expect(authorizationTestDb.snapshot("eventSegment").find(row => row.id === 1)?.startsAt).toEqual(new Date("2026-10-04T15:00:00Z"));
        expect(authorizationTestDb.snapshot("eventSegment").find(row => row.id === 2)?.startsAt).toEqual(new Date("2026-10-04T22:00:00Z"));
        await writeCommands([{ hive: "band", key: "dateTime.bandTimeZone", operation: { kind: "reset" } }]);
        expect(authorizationTestDb.snapshot("eventSegment").find(row => row.id === 1)?.startsAt).toEqual(new Date("2026-10-04T22:00:00Z"));
    });
});

describe("RPC settings boundaries", () => {
    it.each(["A different backstage title", ""])("delivers localized band identity independently of site title %j", async siteTitle => {
        await database.band.update({ where: { id: 1 }, data: { nameId: 101 } });
        await database.band.update({ where: { id: 2 }, data: { nameId: 102 } });
        await database.bandDynamicLocalizedStringValue.createMany({ data: [
            { publicId: "BandName00000001", bandId: 1, stringId: 101, localeId: 1, indexedValue: "River Band", blobValue: null },
            { publicId: "BandName00000002", bandId: 1, stringId: 101, localeId: 2, indexedValue: "Groupe Rivière", blobValue: null },
            { publicId: "BandName00000003", bandId: 2, stringId: 102, localeId: 1, indexedValue: "Brass Collective", blobValue: null },
        ] });
        await writeCommands([command("band", "siteCustomization.title", siteTitle)]);
        const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal", { id: user.id }));
        const french = await invokeResolver(getPresentationData, { bandPublicId: bandA, routeLocale: "fr-BE" }, ctx);
        expect(french.band).toEqual({ publicId: bandA, name: "Groupe Rivière" });
        expect(french.settings.band["siteCustomization.title"]?.value).toBe(siteTitle);
        const english = await invokeResolver(getPresentationData, { bandPublicId: bandA, routeLocale: "en-US" }, ctx);
        expect(english.band).toEqual({ publicId: bandA, name: "River Band" });
        const other = await invokeResolver(getPresentationData, { bandPublicId: bandB, routeLocale: "en-US" }, ctx);
        expect(other.band).toEqual({ publicId: bandB, name: "Brass Collective" });
        const platform = await invokeResolver(getPresentationData, {}, ctx);
        expect(platform.band).toBeNull();
    });

    it("resolves the supplied band ID and validates its grants", async () => {
        // The harness uses a complete account fixture only to construct session identity.
        const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal", { id: user.id }));
        await invokeResolver(updateSetting, { ...command("band", "siteCustomization.title", "My band"), bandPublicId: bandA }, ctx);
        await expect(invokeResolver(updateSetting, { ...command("band", "siteCustomization.title", "Other"), bandPublicId: bandB }, ctx)).rejects.toThrow();
        await expect(invokeResolver(updateBulkSettings, { commands: [command("user", "calendar.showDeclinedEvents", "false")], bandPublicId: bandA }, ctx)).rejects.toThrow();
        const response = await invokeResolver(getPresentationData, { bandPublicId: bandA, routeLocale: "de-DE", browserLanguages: ["nl-BE"] }, ctx);
        expect(response.localization.formattingLocale).toBe("de-DE");
        expect(response.settings.band["siteCustomization.title"]?.value).toBe("My band");
        expect(response.authorization.bandPublicId).toBe(bandA);
        expect(response.authorization).not.toHaveProperty("bandId");
    });
    it("loads global and account data without a band and rejects band writes without an ID", async () => {
        const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal", { id: user.id }));
        const response = await invokeResolver(getPresentationData, {}, ctx);
        expect(response.authorization.bandPublicId).toBeNull();
        expect(response.settings.band).toEqual({});
        expect(response.settings.bandUser).toEqual({});
        expect(response.settings.user["calendar.showDeclinedEvents"]?.value).toBe(true);
        await invokeResolver(updateSetting, command("user", "calendar.showDeclinedEvents", false), ctx);
        await expect(invokeResolver(updateSetting, command("band", "siteCustomization.title", "Missing band"), ctx)).rejects.toThrow();
        await expect(invokeResolver(getPresentationData, { bandPublicId: "invalid" }, ctx)).rejects.toThrow();
        const retiredInput = { browserLanguages: ["en-US"], selection: { kind: "platform" } };
        await expect(invokeResolver(getPresentationData, retiredInput, ctx)).rejects.toThrow();
    });
    it("refreshes authorization inside the transaction after membership revocation", async () => {
        const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal", { id: user.id }));
        await invokeResolver(updateSetting, { ...command("band", "siteCustomization.title", "Before"), bandPublicId: bandA }, ctx);
        await authorizationTestDb.getDelegate("bandUser").update({ where: { id: 1 }, data: { isDeleted: true } });
        await expect(invokeResolver(updateSetting, { ...command("band", "siteCustomization.title", "Denied"), bandPublicId: bandA }, ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("bandSetting").find(row => row.bandId === 1)?.value).toBe("Before");
    });
});
