import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { loadBandInstrumentCatalog } from "src/core/db3/server/bandInstrumentCatalog";
import { editBandInstrumentCatalog } from "src/core/db3/server/commands/bandInstrumentCommand";
import { readBandInstrumentView } from "src/core/db3/server/bandInstrumentRead";
import { bandInstrumentView, bandInstrumentReferences, xBandInstrumentFunctionalGroup, type BandInstrumentCommand } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";
import { queryTable, DB3PaginatedQueryCore } from "src/core/db3/server/db3QueryCore";
import { validateDB3QueryRequest } from "src/core/db3/server/db3RequestValidation";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function createGlobalCatalog(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const text = async (value: string, format: "PlainText" | "Markdown" = "PlainText") => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), format, values: { create: { publicId: generatePublicId(), localeId: fixture.englishId,
            indexedValue: format === "PlainText" ? value : null, blobValue: format === "Markdown" ? value : null } },
    } });
    const groupName = await text("Woodwinds"), groupDescription = await text("Global group", "Markdown");
    const group = await tx.globalInstrumentFunctionalGroup.create({ data: {
        publicId: generatePublicId(), nameId: groupName.id, descriptionId: groupDescription.id, sortOrder: 7, color: "blue",
    } });
    const name = await text("Flute"), description = await text("Global instrument", "Markdown");
    const instrument = await tx.globalInstrument.create({ data: {
        publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, functionalGroupId: group.id,
        sortOrder: 11, autoAssignFileLeafRegex: "flute",
    } });
    return { group: { ...group, publicId: parsePublicId(group.publicId) },
        instrument: { ...instrument, publicId: parsePublicId(instrument.publicId) } };
}

async function grantInstrumentAdministration(tx: Prisma.TransactionClient, bandRoleId: number) {
    const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_instruments } });
    await tx.bandRolePermission.createMany({ data: { publicId: generatePublicId(), bandRoleId, permissionId: permission.id }, skipDuplicates: true });
}

describe.skipIf(!settingsMysqlTestUrl)("band-instrument vertical slice on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        await grantInstrumentAdministration(tx, member.bandRoleId!);
        await work(tx, fixture);
    });
    const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
        loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));

    it("opts in once, inherits current global values, and hydrates the functional-group reference", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const global = await createGlobalCatalog(tx, fixture);
        const first = await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const auditCount = await tx.change.count({ where: { userId: fixture.user.id } });
        expect(await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId })).toEqual(first);
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBe(auditCount);
        expect(await tx.bandInstrument.count({ where: { bandId: auth.requireBand().id } })).toBe(1);
        expect(await tx.bandInstrumentFunctionalGroup.count({ where: { bandId: auth.requireBand().id } })).toBe(1);
        const catalog = await loadBandInstrumentCatalog(tx, auth);
        expect(catalog.instruments[0]).toMatchObject({ name: "Flute", description: "Global instrument", sortOrder: 11, autoAssignFileLeafRegex: "flute", nameStringPublicId: null });
        const store = new DB3ReferenceStore(bandInstrumentReferences);
        store.register(xBandInstrumentFunctionalGroup, catalog.groups);
        expect(bandInstrumentView.hydrate(catalog.instruments[0]!, store).functionalGroup).toMatchObject({ name: "Woodwinds", color: "blue" });
        await tx.globalInstrument.update({ where: { id: global.instrument.id }, data: { sortOrder: 23 } });
        expect((await loadBandInstrumentCatalog(tx, auth)).instruments[0]?.sortOrder).toBe(23);
        expect(JSON.stringify(catalog)).not.toContain('"nameId"');
        expect(JSON.stringify(catalog)).not.toContain('"bandId"');
    }));

    it("resolves band French ahead of global Dutch and keeps a blank override", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        await tx.dynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: global.instrument.nameId, localeId: fixture.dutchId, indexedValue: "Fluit" } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: auth.requireBand().id,
            stringId: global.instrument.nameId, localeId: fixture.frenchId, indexedValue: "Flûte" } });
        const input = { routeLocale: "de-DE", browserLanguages: ["nl-BE"] };
        expect((await loadBandInstrumentCatalog(tx, auth, input)).instruments[0]).toMatchObject({ name: "Flûte", nameResolution: { scope: "band", localeTag: "fr-BE" } });
        const row = (await loadBandInstrumentCatalog(tx, auth)).instruments[0]!;
        await editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId: row.publicId,
            patch: { name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "" } } });
        expect((await loadBandInstrumentCatalog(tx, auth, input)).instruments[0]?.name).toBe("");
        const local = (await loadBandInstrumentCatalog(tx, auth)).instruments[0]!;
        await editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId: row.publicId,
            patch: { name: { kind: "inherit", stringPublicId: local.nameStringPublicId! } } });
        expect((await loadBandInstrumentCatalog(tx, auth, input)).instruments[0]?.name).toBe("Flûte");
    }));

    it("does not restore global text underneath an untranslated local identity", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        const opted = await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
        await tx.bandInstrument.update({ where: { publicId: opted.publicId }, data: { nameId: name.id } });
        expect((await loadBandInstrumentCatalog(tx, auth)).instruments[0]).toMatchObject({ name: null, nameResolution: { source: "missing" } });
    }));

    it("creates custom records and format-specific band values, never global translations", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const group = await editBandInstrumentCatalog(tx, auth, { kind: "createGroup", name: "Custom group", description: "**Group**", localeTag: "fr-BE", sortOrder: 4, color: "red" });
        await editBandInstrumentCatalog(tx, auth, { kind: "createInstrument", name: "Custom flute", description: "**Instrument**", localeTag: "fr-BE",
            functionalGroupId: parsePublicId<"InstrumentFunctionalGroup">(group.publicId), sortOrder: 1, autoAssignFileLeafRegex: "flute" });
        const catalog = await loadBandInstrumentCatalog(tx, auth);
        expect(catalog.instruments[0]).toMatchObject({ name: "Custom flute", description: "**Instrument**", globalPublicId: null });
        const owned = await tx.bandDynamicLocalizedStringValue.findMany({ where: { bandId: auth.requireBand().id } });
        expect(owned).toHaveLength(4);
        expect(owned.every(row => (row.indexedValue === null) !== (row.blobValue === null))).toBe(true);
        const ownIds = owned.map(row => row.stringId);
        expect(await tx.dynamicLocalizedStringValue.count({ where: { stringId: { in: ownIds } } })).toBe(0);
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBeGreaterThanOrEqual(6);
    }));

    it("rejects another band's grants, resource references, and field identities", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const global = await createGlobalCatalog(tx, fixture);
        const opted = await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        await expect(editBandInstrumentCatalog(tx, other, { kind: "optInInstrument", globalPublicId: global.instrument.publicId })).rejects.toThrow();
        await expect(editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId: parsePublicId<"Instrument">(opted.publicId),
            patch: { name: { kind: "set", stringPublicId: parsePublicId<"DynamicLocalizedString">(generatePublicId()), localeTag: "en-US", value: "Forged" } } })).rejects.toThrow();
        const outsiderGroup = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: other.requireBand().id } });
        await expect(editBandInstrumentCatalog(tx, auth, { kind: "createInstrument", name: "Bad", description: "", localeTag: "en-US",
            functionalGroupId: parsePublicId<"InstrumentFunctionalGroup">(outsiderGroup.publicId), sortOrder: 0, autoAssignFileLeafRegex: null })).rejects.toThrow();
        expect((await loadBandInstrumentCatalog(tx, other)).instruments).toEqual([]);
        await expect(loadBandInstrumentCatalog(tx, other, {}, true)).rejects.toThrow();
        const unscoped = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(loadBandInstrumentCatalog(tx, unscoped)).rejects.toThrow();
    }));

    it("checks locale availability and format, and hiding preserves associations", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        const opted = await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const publicId = parsePublicId<"Instrument">(opted.publicId);
        const stored = await tx.bandInstrument.findUniqueOrThrow({ where: { publicId } });
        await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: auth.requireMembership().id, bandInstrumentId: stored.id } });
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: auth.requireBand().id, localeId: fixture.frenchId } } });
        await expect(editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId,
            patch: { name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "Unavailable" } } })).rejects.toThrow();
        const wrongFormat = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format: "Markdown" } });
        await tx.bandInstrument.update({ where: { publicId }, data: { nameId: wrongFormat.id } });
        await expect(editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId,
            patch: { name: { kind: "set", stringPublicId: parsePublicId<"DynamicLocalizedString">(wrongFormat.publicId), localeTag: "en-US", value: "Bad format" } } })).rejects.toThrow();
        await editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId, patch: { isHidden: true } });
        expect((await loadBandInstrumentCatalog(tx, auth)).instruments).toEqual([]);
        expect((await loadBandInstrumentCatalog(tx, auth, {}, true)).instruments).toHaveLength(1);
        expect(await tx.bandInstrument.count({ where: { publicId } })).toBe(1);
        expect(await tx.bandUserInstrument.count({ where: { bandUserId: auth.requireMembership().id, bandInstrumentId: stored.id } })).toBe(1);
    }));

    it("uses resolved names for generic DB3 filtering, sorting, and paging", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const request = { table: { tableID: bandInstrumentView.tableID, tableName: bandInstrumentView.tableName, viewID: bandInstrumentView.viewID },
            orderBy: { name: "asc" }, filter: { quickFilterValues: ["flut"] }, cmdbQueryContext: "native instrument query", routeLocale: "en-US" };
        const result = await readBandInstrumentView(tx, auth, request, 0, 1);
        expect(result.count).toBe(1);
        expect(result.items[0]?.name).toBe("Flute");
        expect((await queryTable({ ...request, take: 1 }, auth, tx)).items[0]?.name).toBe("Flute");
        expect(await DB3PaginatedQueryCore({ ...request, take: 1, skip: 0 }, auth, tx)).toMatchObject({ count: 1, hasMore: false, nextPage: null });
        const groupPublicId = (await loadBandInstrumentCatalog(tx, auth)).groups[0]!.publicId;
        const groupRequest = validateDB3QueryRequest({ ...request, bandPublicId: auth.requireBand().publicId,
            filter: { items: [{ field: "functionalGroupId", operator: "equals", value: groupPublicId }] } });
        expect((await queryTable(groupRequest, auth, tx)).items).toHaveLength(1);
        expect((await readBandInstrumentView(tx, auth, { ...request,
            filter: { items: [{ field: "functionalGroupId", operator: "equals", value: generatePublicId() }] } })).count).toBe(0);
        await expect(readBandInstrumentView(tx, auth, { ...request, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow();
        await expect(readBandInstrumentView(tx, auth, { ...request, filter: { pks: [1] } })).rejects.toThrow();
        await expect(queryTable({ ...request, table: { tableID: "Event", tableName: "Event" } }, auth, tx)).rejects.toThrow();
    }));

    it("keeps two opted-in bands' overrides separate and rejects revoked and inactive memberships", () => withFixture(async (tx, fixture) => {
        const membership = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: membership.bandRoleId } });
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const global = await createGlobalCatalog(tx, fixture);
        await editBandInstrumentCatalog(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const otherIdentity = await editBandInstrumentCatalog(tx, other, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const first = (await loadBandInstrumentCatalog(tx, auth)).instruments[0]!;
        await editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId: first.publicId,
            patch: { name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "Band A" } } });
        expect((await loadBandInstrumentCatalog(tx, auth)).instruments[0]?.name).toBe("Band A");
        expect((await loadBandInstrumentCatalog(tx, other)).instruments[0]?.name).toBe("Flute");
        await expect(editBandInstrumentCatalog(tx, auth, { kind: "updateInstrument", publicId: parsePublicId<"Instrument">(otherIdentity.publicId), patch: { sortOrder: 9 } })).rejects.toThrow();
        await tx.bandUser.update({ where: { id: membership.id }, data: { isDeleted: true } });
        await expect(editBandInstrumentCatalog(tx, await auth.refresh(tx), { kind: "updateInstrument", publicId: first.publicId, patch: { sortOrder: 3 } })).rejects.toThrow();
        await tx.bandUser.update({ where: { id: membership.id }, data: { isDeleted: false, bandRoleId: null } });
        await expect(editBandInstrumentCatalog(tx, await auth.refresh(tx), { kind: "updateInstrument", publicId: first.publicId, patch: { sortOrder: 3 } })).rejects.toThrow();
    }));

    it("rolls back strings, entities, and audits when the enclosing mutation fails", async () => {
        let bandId = 0;
        const failure = new Error("Fail after catalog writes");
        await expect(database.$transaction(async tx => {
            const role = await tx.bandRole.findFirstOrThrow({ where: { bandRolePermissions: { some: { permission: { name: Permission.manage_band_settings } } } } });
            await grantInstrumentAdministration(tx, role.id);
            const bandName = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
            const band = await tx.band.create({ data: { publicId: generatePublicId(), nameId: bandName.id } });
            bandId = band.id;
            const locale = await tx.locale.findFirstOrThrow({ where: { ietfTag: "en-US" } });
            await tx.bandLocale.create({ data: { bandId, localeId: locale.id } });
            const user = await tx.user.create({ data: { publicId: generatePublicId(), name: "Rollback user", email: "rollback-instrument@test.invalid" } });
            await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId, userId: user.id, bandRoleId: role.id } });
            const auth = await loadAuthorizationForUser(user, tx, parsePublicId<"Band">(band.publicId));
            const command: BandInstrumentCommand = { kind: "createGroup", name: "Rolled back", description: "", localeTag: "en-US", color: null, sortOrder: 0 };
            await editBandInstrumentCatalog(tx, auth, command);
            throw failure;
        }, { timeout: 30_000 })).rejects.toBe(failure);
        expect(await database.bandInstrumentFunctionalGroup.count({ where: { bandId } })).toBe(0);
        expect(await database.bandDynamicLocalizedStringValue.count({ where: { bandId } })).toBe(0);
        expect(await database.user.count({ where: { email: "rollback-instrument@test.invalid" } })).toBe(0);
    });
});
