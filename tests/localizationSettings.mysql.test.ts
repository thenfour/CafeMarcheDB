import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { createAllDayRange } from "shared/time";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { loadLocalizationCatalog, lookupStaticTranslation, resolveAuthorizedDynamicStrings } from "src/locale/server/localization";
import { loadSettingsSnapshot, writeSettings } from "src/setting/server/settings";
import { readSettingSnapshot } from "src/setting/shared/settingsContract";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const testUrl = settingsMysqlTestUrl;

describe.skipIf(!testUrl)("phase-2 foundations on MariaDB/MySQL", () => {
    const database = new PrismaClient(testUrl ? { datasources: { db: { url: testUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, work);

    it("round-trips the same native JSON values in every hive", () => withFixture(async (tx, fixture) => {
        const band = fixture.bands[0]!;
        const membership = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
        const values: Array<Prisma.InputJsonValue | null> = ["", "false", false, 0, null, { nested: ["text", 1, false, null] }, [true, "123"]];
        for (const [index, value] of values.entries()) {
            const name = `native-json-${index}`;
            const json = value ?? Prisma.JsonNull;
            const rows = await Promise.all([
                tx.globalSetting.create({ data: { publicId: generatePublicId(), name, value: json } }),
                tx.bandSetting.create({ data: { publicId: generatePublicId(), bandId: band.id, name, value: json } }),
                tx.userSetting.create({ data: { userId: fixture.user.id, name, value: json } }),
                tx.bandUserSetting.create({ data: { bandUserId: membership.id, name, value: json } }),
            ]);
            expect(rows.map(row => row.value)).toEqual([value, value, value, value]);
        }
    }));

    it("resolves complete static catalogs and authorized dynamic batches with locale availability", () => withFixture(async (tx, fixture) => {
        const first = fixture.bands[0]!, second = fixture.bands[1]!;
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(first.publicId));
        const other = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(second.publicId));
        const stringKey = "common.action.ok";
        await tx.staticLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringKey, localeId: fixture.dutchId, indexedValue: "Global Dutch" } });
        await tx.bandStaticLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringKey, localeId: fixture.frenchId, bandId: first.id, indexedValue: "Band French" } });
        const input = { routeLocale: "de-DE", browserLanguages: ["nl-BE"] };
        const catalog = await loadLocalizationCatalog(tx, auth, input);
        console.info(`[phase2-catalog] ${Object.keys(catalog.strings).length} keys, ${catalog.payloadBytes} UTF-8 bytes`);
        expect(catalog.strings[stringKey]).toMatchObject({ value: "Band French", localeTag: "fr-BE", scope: "band" });
        expect(catalog.formattingLocale).toBe("de-DE");
        expect((await loadLocalizationCatalog(tx, other, input)).strings[stringKey]?.value).toBe("Global Dutch");
        expect(await lookupStaticTranslation(tx, auth, stringKey, "nl-BE", "band")).toBeNull();
        const identity = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Dynamic English" } } } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: first.id, stringId: identity.id, localeId: fixture.frenchId, indexedValue: "" } });
        expect((await resolveAuthorizedDynamicStrings(tx, auth, [identity.id], input)).get(identity.id)?.value).toBe("");
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: first.id, localeId: fixture.frenchId } } });
        expect((await loadLocalizationCatalog(tx, auth, input)).strings[stringKey]).toMatchObject({ value: null, reason: "unavailable-override" });
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: second.id, localeId: fixture.dutchId } } });
        expect((await loadLocalizationCatalog(tx, other, input)).strings[stringKey]).toMatchObject({ value: "OK", source: "registry" });
        await tx.locale.update({ where: { id: fixture.frenchId }, data: { isDeleted: true } });
        expect((await loadLocalizationCatalog(tx, auth, input)).strings[stringKey]?.value).toBeNull();
        // Editors see the stored value even when presentation excludes its locale.
        expect(await lookupStaticTranslation(tx, auth, stringKey, "fr-BE", "band")).toBe("Band French");
    }));

    it("persists all four hives with correct JSON types, scope and reset", () => withFixture(async (tx, fixture) => {
        const band = fixture.bands[0]!;
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await writeSettings(tx, auth, [
            { hive: "band", key: "siteCustomization.title", operation: { kind: "set", value: "" } },
            { hive: "user", key: "calendar.showDeclinedEvents", operation: { kind: "set", value: false } },
            { hive: "bandUser", key: "calendar.locale", operation: { kind: "set", value: "fr-BE" } },
        ], CreateChangeContext("four-hives"));
        await writeSettings(tx, platform, [{ hive: "global", key: "global.ui.event.tags.selectStyle", operation: { kind: "set", value: "dialog" } }], CreateChangeContext("global-hive"));
        const settings = await loadSettingsSnapshot(tx, auth);
        expect(readSettingSnapshot(settings, "band", "siteCustomization.title")).toBe("");
        expect(readSettingSnapshot(settings, "user", "calendar.showDeclinedEvents")).toBe(false);
        expect(readSettingSnapshot(settings, "bandUser", "calendar.locale")).toBe("fr-BE");
        expect(readSettingSnapshot(settings, "global", "global.ui.event.tags.selectStyle")).toBe("dialog");
        expect((await tx.userSetting.findUniqueOrThrow({ where: { userId_name: { userId: fixture.user.id, name: "calendar.showDeclinedEvents" } } })).value).toBe(false);
        expect((await tx.bandSetting.findUniqueOrThrow({ where: { bandId_name: { bandId: band.id, name: "siteCustomization.title" } } })).value).toBe("");
        const auditCount = await tx.change.count({ where: { userId: fixture.user.id } });
        await writeSettings(tx, auth, [{ hive: "user", key: "calendar.showDeclinedEvents", operation: { kind: "set", value: false } }], CreateChangeContext("unchanged"));
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBe(auditCount);
        await writeSettings(tx, auth, [{ hive: "band", key: "siteCustomization.title", operation: { kind: "reset" } }], CreateChangeContext("reset"));
        expect((await loadSettingsSnapshot(tx, auth)).band["siteCustomization.title"]?.source).toBe("default");
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBe(4);
    }));

    it("shares the protected developer palette across bands and rejects a revoked global writer", () => withFixture(async (tx, fixture) => {
        const key = "global.dev.textPalette";
        const firstBand = parsePublicId<"Band">(fixture.bands[0]!.publicId);
        const secondBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await writeSettings(tx, platform, [{ hive: "global", key, operation: { kind: "set", value: "#123456" } }], CreateChangeContext("palette"));
        for (const band of [firstBand, secondBand]) {
            const scoped = await loadAuthorizationForUser(fixture.admin, tx, band);
            expect(readSettingSnapshot(await loadSettingsSnapshot(tx, scoped), "global", key)).toBe("#123456");
        }
        const member = await loadAuthorizationForUser(fixture.user, tx, firstBand);
        expect((await loadSettingsSnapshot(tx, member)).global[key]).toBeUndefined();
        await expect(writeSettings(tx, member, [{ hive: "global", key, operation: { kind: "set", value: "Denied" } }], CreateChangeContext("palette-denied"))).rejects.toThrow();
        await writeSettings(tx, platform, [{ hive: "global", key, operation: { kind: "set", value: "" } }], CreateChangeContext("palette-blank"));
        await tx.user.update({ where: { id: fixture.admin.id }, data: { globalRoleId: null } });
        const revoked = await platform.refresh(tx);
        await expect(writeSettings(tx, revoked, [{ hive: "global", key, operation: { kind: "set", value: "Denied" } }], CreateChangeContext("palette-revoked"))).rejects.toThrow();
        expect((await tx.globalSetting.findUniqueOrThrow({ where: { name: key } })).value).toBe("");
        expect(await tx.bandSetting.count({ where: { name: key } })).toBe(0);
    }));

    it("rejects other-band grants and an invalid batch without partial changes", () => withFixture(async (tx, fixture) => {
        const second = fixture.bands[1]!;
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(second.publicId));
        await expect(writeSettings(tx, auth, [{ hive: "band", key: "siteCustomization.title", operation: { kind: "set", value: "Denied" } }], CreateChangeContext("denied"))).rejects.toThrow();
        await expect(writeSettings(tx, auth, [
            { hive: "user", key: "calendar.showDeclinedEvents", operation: { kind: "set", value: false } },
            { hive: "user", key: "calendar.showUninvitedEvents", operation: { kind: "set", value: "false" } },
        ], CreateChangeContext("invalid-batch"))).rejects.toThrow();
        expect(await tx.userSetting.count({ where: { userId: fixture.user.id } })).toBe(0);
        expect(await tx.bandSetting.count({ where: { bandId: second.id } })).toBe(0);
        await tx.bandUser.update({ where: { id: auth.membership!.id }, data: { isDeleted: true } });
        const inactive = await auth.refresh(tx);
        expect((await loadSettingsSnapshot(tx, inactive)).bandUser).toEqual({});
        await expect(writeSettings(tx, inactive, [{ hive: "bandUser", key: "calendar.locale", operation: { kind: "set", value: "fr-BE" } }], CreateChangeContext("inactive"))).rejects.toThrow();
    }));

    it("reanchors only the selected band's all-day spans and derived bounds", () => withFixture(async (tx, fixture) => {
        const first = fixture.bands[0]!, second = fixture.bands[1]!;
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(first.publicId));
        const spec = createAllDayRange({ startDate: "2026-10-25", endDateExclusive: "2026-10-26" }, "Europe/Brussels").getSpec();
        const events: Array<{ id: number }> = [];
        for (const band of [first, second]) events.push(await tx.event.create({ data: {
            publicId: generatePublicId(), name: "All day", bandId: band.id, uid: generatePublicId(), durationMillis: 0, revision: 0,
            segments: { create: { publicId: generatePublicId(), name: "Day", description: "", startsAt: spec.startsAtDateTime, durationMillis: spec.durationMillis, isAllDay: true } },
        }, include: { segments: true } }));
        await writeSettings(tx, auth, [{ hive: "band", key: "dateTime.bandTimeZone", operation: { kind: "set", value: "Asia/Tokyo" } }], CreateChangeContext("timezone"));
        expect(await loadBandTimeZone(tx, first.id)).toBe("Asia/Tokyo");
        expect(await loadBandTimeZone(tx, second.id)).toBe("Europe/Brussels");
        const changed = await tx.event.findUniqueOrThrow({ where: { id: events[0]!.id }, include: { segments: true } });
        const unchanged = await tx.event.findUniqueOrThrow({ where: { id: events[1]!.id }, include: { segments: true } });
        expect(changed.startsAt?.toISOString()).toBe("2026-10-24T15:00:00.000Z");
        expect(Number(changed.durationMillis)).toBe(86_400_000);
        expect(unchanged.segments[0]?.startsAt).toEqual(spec.startsAtDateTime);
        await writeSettings(tx, auth, [{ hive: "band", key: "dateTime.bandTimeZone", operation: { kind: "reset" } }], CreateChangeContext("reset-timezone"));
        const restored = await tx.eventSegment.findUniqueOrThrow({ where: { id: changed.segments[0]!.id } });
        expect(restored.startsAt).toEqual(spec.startsAtDateTime);
        expect(Number(restored.durationMillis)).toBe(spec.durationMillis);
    }));
});
