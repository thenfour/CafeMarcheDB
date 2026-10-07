import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { loadLocalizationCatalog } from "src/locale/server/localization";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import { loadDashboardCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { hydrateDashboardData, type DashboardDataDto } from "src/core/db3/shared/references/dashboardData";
import { bandInstrumentView, bandInstrumentGroupView, xBandInstrument, xBandInstrumentFunctionalGroup } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { bandSongTagView, xBandSongTag } from "src/core/db3/shared/entities/song/bandSongTagViews";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("dashboard catalog references on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
        loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));

    async function seedCatalog(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: {
            bandId: fixture.bands[0]!.id, userId: fixture.user.id,
        } } });
        const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.admin_instruments, Permission.admin_songs] } } });
        await tx.bandRolePermission.createMany({ data: permissions.map(permission => ({
            publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id,
        })), skipDuplicates: true });
        const auth = await authorize(tx, fixture);
        const text = (value: string) => ({ kind: "set", localeTag: "en-US", stringPublicId: null, value });
        const group = await executeCatalogCrud(tx, auth, bandInstrumentGroupView, {
            name: text("Brass"), description: text("Group"), color: "orange", sortOrder: 2,
        });
        const instrument = await executeCatalogCrud(tx, auth, bandInstrumentView, {
            name: text("Trumpet"), description: text("Instrument"), functionalGroupId: group.identity, sortOrder: 1,
        });
        const tag = await executeCatalogCrud(tx, auth, bandSongTagView, {
            name: text("Concert"), description: text("Tag"), color: "blue", sortOrder: 3, group: "Programme", indicator: "C",
        });
        const ownedNames = await Promise.all([
            tx.bandInstrumentFunctionalGroup.findUniqueOrThrow({ where: { publicId: String(group.identity) } }),
            tx.bandInstrument.findUniqueOrThrow({ where: { publicId: String(instrument.identity) } }),
            tx.bandSongTag.findUniqueOrThrow({ where: { publicId: String(tag.identity) } }),
        ]);
        for (const [index, entry] of ownedNames.entries()) {
            await tx.bandDynamicLocalizedStringValue.create({ data: {
                publicId: generatePublicId(), stringId: entry.nameId!, bandId: fixture.bands[0]!.id,
                localeId: fixture.frenchId, indexedValue: ["Cuivres", "Trompette", "Spectacle"][index]!,
            } });
        }
        return { auth, group, instrument, tag, member };
    }

    async function dashboardSnapshot(tx: Prisma.TransactionClient, auth: CMServerAuthorization, routeLocale: string): Promise<DashboardDataDto> {
        const context = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        const [catalogs, localization, settings] = await Promise.all([
            loadDashboardCatalogs(context, auth, { routeLocale, browserLanguages: ["en-US"] }),
            loadLocalizationCatalog(tx, auth, { routeLocale, browserLanguages: ["en-US"] }),
            loadSettingsSnapshot(tx, auth),
        ]);
        // Other dashboard resources are unrelated to these catalog/reference contracts.
        return { ...catalogs, localization, settings, currentMembership: null, authorization: auth.toClientContext(),
            permission: [], wikiPageTag: [], eventType: [], eventStatus: [], eventTag: [],
            eventAttendance: [], fileTag: [], songCreditType: [], dynMenuLinks: [], relevantEventIds: [],
            serverBaseUri: "https://example.test", serverStartupState: null, bandTimeZone: "Europe/Brussels" };
    }

    it("hydrates effective localized values and shares the dashboard store with editor references", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedCatalog(tx, fixture);
            const dto = await dashboardSnapshot(tx, seed.auth, "fr-BE");
            expect(dto.instrument[0]).toMatchObject({ name: "Trompette", functionalGroupId: seed.group.identity });
            expect(dto.instrumentFunctionalGroup[0]).toMatchObject({ name: "Cuivres", color: "orange" });
            expect(dto.songTag[0]).toMatchObject({ name: "Spectacle", color: "blue" });
            for (const row of [...dto.instrument, ...dto.instrumentFunctionalGroup, ...dto.songTag]) {
                expect(row).not.toHaveProperty("id");
                expect(row).not.toHaveProperty("bandId");
                expect(row).not.toHaveProperty("nameId");
            }
            const client = hydrateDashboardData(dto);
            expect(client.instrument[0]!.name).toBe("Trompette");
            expect(client.instrumentFunctionalGroup[0]!.color).toMatchObject({ id: "orange" });
            expect(client.songTag[0]!.color).toMatchObject({ id: "blue" });
            expect(client.songTag[0]!.group).toBe("Programme");
            expect(client.instrument[0]!.functionalGroup).toBe(client.instrumentFunctionalGroup[0]);
            expect(client.referenceStore.get(xBandInstrument, xBandInstrument.parseIdentity(seed.instrument.identity))).toBe(client.instrument[0]);
            expect(client.referenceStore.get(xBandInstrumentFunctionalGroup, xBandInstrumentFunctionalGroup.parseIdentity(seed.group.identity))).toBe(client.instrumentFunctionalGroup[0]);
            expect(client.referenceStore.get(xBandSongTag, xBandSongTag.parseIdentity(seed.tag.identity))).toBe(client.songTag[0]);
            const editor = bandInstrumentView.hydrate(dto.instrument[0]!, client.referenceStore);
            expect(editor.name.value).toBe("Trompette");
            expect(editor.functionalGroup).toBe(client.instrumentFunctionalGroup[0]);
            expect(dto.instrumentFunctionalGroup[0]!.color).toBe("orange");
        }));

    it("replaces all three reference collections when locale or band changes", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedCatalog(tx, fixture);
            const first = hydrateDashboardData(await dashboardSnapshot(tx, seed.auth, "fr-BE"));
            const english = hydrateDashboardData(await dashboardSnapshot(tx, seed.auth, "en-US"));
            expect(english.instrument[0]!.name).toBe("Trumpet");
            expect(english.instrumentFunctionalGroup[0]!.name).toBe("Brass");
            expect(english.songTag[0]!.name).toBe("Concert");
            expect(english.referenceStore).not.toBe(first.referenceStore);
            const other = hydrateDashboardData(await dashboardSnapshot(tx, await authorize(tx, fixture, 1), "fr-BE"));
            expect(other.instrument).toEqual([]);
            expect(other.instrumentFunctionalGroup).toEqual([]);
            expect(other.songTag).toEqual([]);
            expect(other.referenceStore.get(xBandInstrument, xBandInstrument.parseIdentity(seed.instrument.identity))).toBeUndefined();
            expect(other.referenceStore.get(xBandInstrumentFunctionalGroup, xBandInstrumentFunctionalGroup.parseIdentity(seed.group.identity))).toBeUndefined();
            expect(other.referenceStore.get(xBandSongTag, xBandSongTag.parseIdentity(seed.tag.identity))).toBeUndefined();
        }));

    it("refreshes grants before reading hidden entries and suppresses instruments with hidden groups", () =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const seed = await seedCatalog(tx, fixture);
            await executeCatalogCrud(tx, seed.auth, bandInstrumentGroupView, { isHidden: true }, seed.group.identity);
            await executeCatalogCrud(tx, seed.auth, bandSongTagView, { isHidden: true }, seed.tag.identity);
            const admin = hydrateDashboardData(await dashboardSnapshot(tx, seed.auth, "en-US"));
            expect(admin.instrument).toHaveLength(1);
            expect(admin.instrumentFunctionalGroup).toHaveLength(1);
            expect(admin.songTag).toHaveLength(1);
            await tx.bandUser.update({ where: { id: seed.member.id }, data: { bandRoleId: null } });
            const context = await bindDB3ReadSnapshot(tx, seed.auth, { isolationLevel: "Serializable" });
            // The original authorization still has admin grants; the reader must refresh them itself.
            expect(await loadDashboardCatalogs(context, seed.auth, { routeLocale: "en-US" })).toEqual({
                instrument: [], instrumentFunctionalGroup: [], songTag: [], userTag: [], eventTag: [],
            });
            const unscoped = await loadAuthorizationForUser(fixture.user, tx);
            expect(await loadDashboardCatalogs(context, unscoped, { routeLocale: "en-US" })).toEqual({
                instrument: [], instrumentFunctionalGroup: [], songTag: [], userTag: [], eventTag: [],
            });
        }));
});


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:tests/db3DashboardCatalogs.mysql.test.ts:1-137
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 0a1bebfa3911365a8ed9e22a8d6975198560e17d9ca4fef8c1ed64f377cd96ca
// MIGRATION_REFERENCE_BEGIN
// import { PrismaClient, type Prisma } from "@prisma/client";
// import { afterAll, beforeAll, describe, expect, it } from "vitest";
// import { Permission } from "shared/permissions";
// import { parsePublicId } from "shared/publicId";
// import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
// import { generatePublicId } from "src/server/publicId";
// import { initializeAccessControl } from "src/setup/accessControl";
// import { loadLocalizationCatalog } from "src/locale/server/localization";
// import { loadSettingsSnapshot } from "src/setting/server/settings";
// import { loadDashboardCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
// import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
// import { hydrateDashboardData, type DashboardDataDto } from "src/core/db3/shared/references/dashboardData";
// import { bandInstrumentView, bandInstrumentGroupView, xBandInstrument, xBandInstrumentFunctionalGroup } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
// import { bandSongTagView, xBandSongTag } from "src/core/db3/shared/entities/song/bandSongTagViews";
// import { executeCatalogCrud } from "./support/db3CatalogFixture";
// import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
//
// describe.skipIf(!settingsMysqlTestUrl)("dashboard catalog references on MariaDB", () => {
//     const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
//     beforeAll(() => initializeAccessControl(database), 30_000);
//     afterAll(() => database.$disconnect());
//     const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
//         loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));
//
//     async function seedCatalog(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
//         const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: {
//             bandId: fixture.bands[0]!.id, userId: fixture.user.id,
//         } } });
//         const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.admin_instruments, Permission.admin_songs] } } });
//         await tx.bandRolePermission.createMany({ data: permissions.map(permission => ({
//             publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id,
//         })), skipDuplicates: true });
//         const auth = await authorize(tx, fixture);
//         const text = (value: string) => ({ kind: "set", localeTag: "en-US", stringPublicId: null, value });
//         const group = await executeCatalogCrud(tx, auth, bandInstrumentGroupView, {
//             name: text("Brass"), description: text("Group"), color: "orange", sortOrder: 2,
//         });
//         const instrument = await executeCatalogCrud(tx, auth, bandInstrumentView, {
//             name: text("Trumpet"), description: text("Instrument"), functionalGroupId: group.identity, sortOrder: 1,
//         });
//         const tag = await executeCatalogCrud(tx, auth, bandSongTagView, {
//             name: text("Concert"), description: text("Tag"), color: "blue", sortOrder: 3, group: "Programme", indicator: "C",
//         });
//         const ownedNames = await Promise.all([
//             tx.bandInstrumentFunctionalGroup.findUniqueOrThrow({ where: { publicId: String(group.identity) } }),
//             tx.bandInstrument.findUniqueOrThrow({ where: { publicId: String(instrument.identity) } }),
//             tx.bandSongTag.findUniqueOrThrow({ where: { publicId: String(tag.identity) } }),
//         ]);
//         for (const [index, entry] of ownedNames.entries()) {
//             await tx.bandDynamicLocalizedStringValue.create({ data: {
//                 publicId: generatePublicId(), stringId: entry.nameId!, bandId: fixture.bands[0]!.id,
//                 localeId: fixture.frenchId, indexedValue: ["Cuivres", "Trompette", "Spectacle"][index]!,
//             } });
//         }
//         return { auth, group, instrument, tag, member };
//     }
//
//     async function dashboardSnapshot(tx: Prisma.TransactionClient, auth: CMServerAuthorization, routeLocale: string): Promise<DashboardDataDto> {
//         const context = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
//         const [catalogs, localization, settings] = await Promise.all([
//             loadDashboardCatalogs(context, auth, { routeLocale, browserLanguages: ["en-US"] }),
//             loadLocalizationCatalog(tx, auth, { routeLocale, browserLanguages: ["en-US"] }),
//             loadSettingsSnapshot(tx, auth),
//         ]);
//         // Other dashboard resources are unrelated to these catalog/reference contracts.
//         return { ...catalogs, localization, settings, currentMembership: null, authorization: auth.toClientContext(),
//             permission: [], role: [], wikiPageTag: [], eventType: [], eventStatus: [], eventTag: [],
//             eventAttendance: [], fileTag: [], songCreditType: [], dynMenuLinks: [], relevantEventIds: [],
//             serverBaseUri: "https://example.test", serverStartupState: null, bandTimeZone: "Europe/Brussels" };
//     }
//
//     it("hydrates effective localized values and shares the dashboard store with editor references", () =>
//         withSettingsMysqlFixture(database, async (tx, fixture) => {
//             const seed = await seedCatalog(tx, fixture);
//             const dto = await dashboardSnapshot(tx, seed.auth, "fr-BE");
//             expect(dto.instrument[0]).toMatchObject({ name: "Trompette", functionalGroupId: seed.group.identity });
//             expect(dto.instrumentFunctionalGroup[0]).toMatchObject({ name: "Cuivres", color: "orange" });
//             expect(dto.songTag[0]).toMatchObject({ name: "Spectacle", color: "blue" });
//             for (const row of [...dto.instrument, ...dto.instrumentFunctionalGroup, ...dto.songTag]) {
//                 expect(row).not.toHaveProperty("id");
//                 expect(row).not.toHaveProperty("bandId");
//                 expect(row).not.toHaveProperty("nameId");
//             }
//             const client = hydrateDashboardData(dto);
//             expect(client.instrument[0]!.name).toBe("Trompette");
//             expect(client.instrumentFunctionalGroup[0]!.color).toMatchObject({ id: "orange" });
//             expect(client.songTag[0]!.color).toMatchObject({ id: "blue" });
//             expect(client.songTag[0]!.group).toBe("Programme");
//             expect(client.instrument[0]!.functionalGroup).toBe(client.instrumentFunctionalGroup[0]);
//             expect(client.referenceStore.get(xBandInstrument, xBandInstrument.parseIdentity(seed.instrument.identity))).toBe(client.instrument[0]);
//             expect(client.referenceStore.get(xBandInstrumentFunctionalGroup, xBandInstrumentFunctionalGroup.parseIdentity(seed.group.identity))).toBe(client.instrumentFunctionalGroup[0]);
//             expect(client.referenceStore.get(xBandSongTag, xBandSongTag.parseIdentity(seed.tag.identity))).toBe(client.songTag[0]);
//             const editor = bandInstrumentView.hydrate(dto.instrument[0]!, client.referenceStore);
//             expect(editor.name.value).toBe("Trompette");
//             expect(editor.functionalGroup).toBe(client.instrumentFunctionalGroup[0]);
//             expect(dto.instrumentFunctionalGroup[0]!.color).toBe("orange");
//         }));
//
//     it("replaces all three reference collections when locale or band changes", () =>
//         withSettingsMysqlFixture(database, async (tx, fixture) => {
//             const seed = await seedCatalog(tx, fixture);
//             const first = hydrateDashboardData(await dashboardSnapshot(tx, seed.auth, "fr-BE"));
//             const english = hydrateDashboardData(await dashboardSnapshot(tx, seed.auth, "en-US"));
//             expect(english.instrument[0]!.name).toBe("Trumpet");
//             expect(english.instrumentFunctionalGroup[0]!.name).toBe("Brass");
//             expect(english.songTag[0]!.name).toBe("Concert");
//             expect(english.referenceStore).not.toBe(first.referenceStore);
//             const other = hydrateDashboardData(await dashboardSnapshot(tx, await authorize(tx, fixture, 1), "fr-BE"));
//             expect(other.instrument).toEqual([]);
//             expect(other.instrumentFunctionalGroup).toEqual([]);
//             expect(other.songTag).toEqual([]);
//             expect(other.referenceStore.get(xBandInstrument, xBandInstrument.parseIdentity(seed.instrument.identity))).toBeUndefined();
//             expect(other.referenceStore.get(xBandInstrumentFunctionalGroup, xBandInstrumentFunctionalGroup.parseIdentity(seed.group.identity))).toBeUndefined();
//             expect(other.referenceStore.get(xBandSongTag, xBandSongTag.parseIdentity(seed.tag.identity))).toBeUndefined();
//         }));
//
//     it("refreshes grants before reading hidden entries and suppresses instruments with hidden groups", () =>
//         withSettingsMysqlFixture(database, async (tx, fixture) => {
//             const seed = await seedCatalog(tx, fixture);
//             await executeCatalogCrud(tx, seed.auth, bandInstrumentGroupView, { isHidden: true }, seed.group.identity);
//             await executeCatalogCrud(tx, seed.auth, bandSongTagView, { isHidden: true }, seed.tag.identity);
//             const admin = hydrateDashboardData(await dashboardSnapshot(tx, seed.auth, "en-US"));
//             expect(admin.instrument).toHaveLength(1);
//             expect(admin.instrumentFunctionalGroup).toHaveLength(1);
//             expect(admin.songTag).toHaveLength(1);
//             await tx.bandUser.update({ where: { id: seed.member.id }, data: { bandRoleId: null } });
//             const context = await bindDB3ReadSnapshot(tx, seed.auth, { isolationLevel: "Serializable" });
//             // The original authorization still has admin grants; the reader must refresh them itself.
//             expect(await loadDashboardCatalogs(context, seed.auth, { routeLocale: "en-US" })).toEqual({
//                 instrument: [], instrumentFunctionalGroup: [], songTag: [], userTag: [],
//             });
//             const unscoped = await loadAuthorizationForUser(fixture.user, tx);
//             expect(await loadDashboardCatalogs(context, unscoped, { routeLocale: "en-US" })).toEqual({
//                 instrument: [], instrumentFunctionalGroup: [], songTag: [], userTag: [],
//             });
//         }));
// });
// MIGRATION_REFERENCE_END
