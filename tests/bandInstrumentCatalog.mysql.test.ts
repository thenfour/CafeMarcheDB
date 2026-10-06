import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { loadBandInstrumentOptInChoices } from "src/core/db3/server/bandInstrumentCatalog";
import { optInBandInstrumentCatalog } from "src/core/db3/server/commands/bandInstrumentCommand";
import { bandInstrumentView, bandInstrumentReferences, bandInstrumentGroupDisplayContract, xBandInstrumentFunctionalGroup, bandInstrumentGroupView, type BandInstrumentCommand } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";
import { bindDB3ReadSnapshot, type DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { queryTable, DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { validateDB3QueryRequest } from "src/core/db3/server/db3RequestValidation";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

/** Collect native named-view results for test assertions; production references arrive with the dashboard. */
async function readCatalogFixture(context: DB3ReadContext, authorization: CMServerAuthorization,
    preferences: LocalePreferenceInput = {}, includeHidden = false,
) {
    authorization.requireBand();
    if (includeHidden) {
        authorization.requirePermission(Permission.admin_instruments);
    }
    const filter = { tableParams: { includeHidden } };
    const [groups, instruments, choices] = await Promise.all([
        queryView({ view: bandInstrumentGroupView, filter, ...preferences, cmdbQueryContext: "fixture groups" }, authorization, context),
        queryView({ view: bandInstrumentView, filter, ...preferences, cmdbQueryContext: "fixture instruments" }, authorization, context),
        loadBandInstrumentOptInChoices(context, authorization, preferences),
    ]);
    return { groups: groups.items, instruments: instruments.items, ...choices };
}

// These fixture activities drive generated CRUD or real opt-in commands, rather than a bespoke CRUD facade.
type FixtureCatalogEdit = BandInstrumentCommand | {
    kind: "updateGroup" | "updateInstrument"; publicId: string; patch: Record<string, unknown>;
} | {
    kind: "createGroup" | "createInstrument"; name: string; description: string; localeTag: string;
    sortOrder: number | null; color?: string | null; autoAssignFileLeafRegex?: string | null; functionalGroupId?: string;
};
async function editCatalogFixture(tx: Prisma.TransactionClient, authorization: CMServerAuthorization, edit: FixtureCatalogEdit) {
    if (edit.kind === "optInGroup" || edit.kind === "optInInstrument") {
        return optInBandInstrumentCatalog(tx, authorization, edit);
    }
    const view = edit.kind === "createGroup" || edit.kind === "updateGroup" ? bandInstrumentGroupView : bandInstrumentView;
    if ("patch" in edit) {
        const result = await executeCatalogCrud(tx, authorization, view, edit.patch, view.entity.parseIdentity(edit.publicId));
        return { publicId: parsePublicId(String(result.identity)) };
    }
    const result = await executeCatalogCrud(tx, authorization, view, {
        name: { kind: "set", stringPublicId: null, localeTag: edit.localeTag, value: edit.name },
        description: { kind: "set", stringPublicId: null, localeTag: edit.localeTag, value: edit.description }, sortOrder: edit.sortOrder,
        ...(edit.kind === "createGroup" ? { color: edit.color } : { autoAssignFileLeafRegex: edit.autoAssignFileLeafRegex, functionalGroupId: edit.functionalGroupId }),
    });
    return { publicId: parsePublicId(String(result.identity)) };
}

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
    const readSnapshot = (tx: Prisma.TransactionClient, auth: Awaited<ReturnType<typeof loadAuthorizationForUser>>) =>
        bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
        loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));

    it("opts in once, inherits current global values, and hydrates the functional-group reference", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const global = await createGlobalCatalog(tx, fixture);
        const first = await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const auditCount = await tx.change.count({ where: { userId: fixture.user.id } });
        expect(await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId })).toEqual(first);
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBe(auditCount);
        expect(await tx.bandInstrument.count({ where: { bandId: auth.requireBand().id } })).toBe(1);
        expect(await tx.bandInstrumentFunctionalGroup.count({ where: { bandId: auth.requireBand().id } })).toBe(1);
        const catalog = await readCatalogFixture(await readSnapshot(tx, auth), auth);
        expect(catalog.instruments[0]).toMatchObject({ name: "Flute", description: "Global instrument", sortOrder: 11, autoAssignFileLeafRegex: "flute", nameStringPublicId: null });
        const store = new DB3ReferenceStore(bandInstrumentReferences);
        store.register(xBandInstrumentFunctionalGroup, catalog.groups.map(group => bandInstrumentGroupDisplayContract.hydrate(group, new DB3ReferenceStore())));
        expect(bandInstrumentView.hydrate(catalog.instruments[0]!, store).functionalGroup).toMatchObject({ name: "Woodwinds", color: { id: "blue" } });
        await tx.globalInstrument.update({ where: { id: global.instrument.id }, data: { sortOrder: 23 } });
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments[0]?.sortOrder).toBe(23);
        expect(JSON.stringify(catalog)).not.toContain('"nameId"');
        expect(JSON.stringify(catalog)).not.toContain('"bandId"');
    }));

    it("resolves band French ahead of global Dutch and keeps a blank override", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        await tx.dynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: global.instrument.nameId, localeId: fixture.dutchId, indexedValue: "Fluit" } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: auth.requireBand().id,
            stringId: global.instrument.nameId, localeId: fixture.frenchId, indexedValue: "Flûte" } });
        const input = { routeLocale: "de-DE", browserLanguages: ["nl-BE"] };
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth, input)).instruments[0]).toMatchObject({ name: "Flûte", nameResolution: { scope: "band", localeTag: "fr-BE" } });
        const row = (await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments[0]!;
        await editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId: row.publicId,
            patch: { name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "" } } });
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth, input)).instruments[0]?.name).toBe("");
        const local = (await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments[0]!;
        await editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId: row.publicId,
            patch: { name: { kind: "inherit", stringPublicId: local.nameStringPublicId! } } });
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth, input)).instruments[0]?.name).toBe("Flûte");
    }));

    it("does not restore global text underneath an untranslated local identity", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        const opted = await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
        await tx.bandInstrument.update({ where: { publicId: opted.publicId }, data: { nameId: name.id } });
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments[0]).toMatchObject({ name: null, nameResolution: { source: "missing" } });
    }));

    it("creates custom records and format-specific band values, never global translations", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const group = await editCatalogFixture(tx, auth, { kind: "createGroup", name: "Custom group", description: "**Group**", localeTag: "fr-BE", sortOrder: 4, color: "red" });
        await editCatalogFixture(tx, auth, { kind: "createInstrument", name: "Custom flute", description: "**Instrument**", localeTag: "fr-BE",
            functionalGroupId: parsePublicId<"InstrumentFunctionalGroup">(group.publicId), sortOrder: 1, autoAssignFileLeafRegex: "flute" });
        const catalog = await readCatalogFixture(await readSnapshot(tx, auth), auth);
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
        const opted = await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        await expect(editCatalogFixture(tx, other, { kind: "optInInstrument", globalPublicId: global.instrument.publicId })).rejects.toThrow();
        await expect(editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId: parsePublicId<"Instrument">(opted.publicId),
            patch: { name: { kind: "set", stringPublicId: parsePublicId<"DynamicLocalizedString">(generatePublicId()), localeTag: "en-US", value: "Forged" } } })).rejects.toThrow();
        const outsiderGroup = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: other.requireBand().id } });
        await expect(editCatalogFixture(tx, auth, { kind: "createInstrument", name: "Bad", description: "", localeTag: "en-US",
            functionalGroupId: parsePublicId<"InstrumentFunctionalGroup">(outsiderGroup.publicId), sortOrder: 0, autoAssignFileLeafRegex: null })).rejects.toThrow();
        expect((await readCatalogFixture(await readSnapshot(tx, other), other)).instruments).toEqual([]);
        await expect(readCatalogFixture(await readSnapshot(tx, other), other, {}, true)).rejects.toThrow();
        const unscoped = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(readCatalogFixture(await readSnapshot(tx, unscoped), unscoped)).rejects.toThrow();
    }));

    it("checks locale availability and format, and hiding preserves associations", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        const opted = await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const publicId = parsePublicId<"Instrument">(opted.publicId);
        const stored = await tx.bandInstrument.findUniqueOrThrow({ where: { publicId } });
        await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: auth.requireMembership().id, bandInstrumentId: stored.id } });
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: auth.requireBand().id, localeId: fixture.frenchId } } });
        await expect(editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId,
            patch: { name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "Unavailable" } } })).rejects.toThrow();
        const wrongFormat = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format: "Markdown" } });
        await tx.bandInstrument.update({ where: { publicId }, data: { nameId: wrongFormat.id } });
        await expect(editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId,
            patch: { name: { kind: "set", stringPublicId: parsePublicId<"DynamicLocalizedString">(wrongFormat.publicId), localeTag: "en-US", value: "Bad format" } } })).rejects.toThrow();
        await editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId, patch: { isHidden: true } });
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments).toEqual([]);
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth, {}, true)).instruments).toHaveLength(1);
        const group = (await readCatalogFixture(await readSnapshot(tx, auth), auth)).groups[0]!;
        await editCatalogFixture(tx, auth, { kind: "updateGroup", publicId: group.publicId, patch: { isHidden: true } });
        await editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId, patch: { isHidden: false } });
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments).toEqual([]);
        const administration = await readCatalogFixture(await readSnapshot(tx, auth), auth, {}, true);
        expect(administration.groups).toHaveLength(1);
        expect(administration.instruments).toHaveLength(1);
        expect(await tx.bandInstrument.count({ where: { publicId } })).toBe(1);
        expect(await tx.bandUserInstrument.count({ where: { bandUserId: auth.requireMembership().id, bandInstrumentId: stored.id } })).toBe(1);
    }));

    it("uses resolved names for generic DB3 filtering, sorting, and paging", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), global = await createGlobalCatalog(tx, fixture);
        await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const request = { table: { tableID: bandInstrumentView.tableID, tableName: bandInstrumentView.tableName, viewID: bandInstrumentView.viewID },
            orderBy: { name: "asc" }, filter: { quickFilterValues: ["flut"] }, cmdbQueryContext: "native instrument query", routeLocale: "en-US" };
        const result = await DB3PaginatedQueryCore({ ...request, skip: 0, take: 1 }, auth, await readSnapshot(tx, auth));
        expect(result.count).toBe(1);
        expect(result.items[0]?.name).toBe("Flute");
        expect((await queryTable({ ...request, take: 1 }, auth, await readSnapshot(tx, auth))).items[0]?.name).toBe("Flute");
        expect(await DB3PaginatedQueryCore({ ...request, take: 1, skip: 0 }, auth, await readSnapshot(tx, auth))).toMatchObject({ count: 1, hasMore: false, nextPage: null });
        const groupPublicId = (await readCatalogFixture(await readSnapshot(tx, auth), auth)).groups[0]!.publicId;
        const groupRequest = validateDB3QueryRequest({ ...request, bandPublicId: auth.requireBand().publicId,
            filter: { items: [{ field: "functionalGroupId", operator: "equals", value: groupPublicId }] } });
        expect((await queryTable(groupRequest, auth, await readSnapshot(tx, auth))).items).toHaveLength(1);
        expect((await DB3PaginatedQueryCore({ ...request, skip: 0, take: 1,
            filter: { items: [{ field: "functionalGroupId", operator: "equals", value: generatePublicId() }] } }, auth, await readSnapshot(tx, auth))).count).toBe(0);
        await expect(queryTable({ ...request, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) }, auth, await readSnapshot(tx, auth))).rejects.toThrow();
        await expect(queryTable({ ...request, filter: { pks: [1] } }, auth, await readSnapshot(tx, auth))).rejects.toThrow();
        await expect(queryTable({ ...request, table: { tableID: "Event", tableName: "Event" } }, auth, await readSnapshot(tx, auth))).rejects.toThrow();
    }));

    it("keeps two opted-in bands' overrides separate and rejects revoked and inactive memberships", () => withFixture(async (tx, fixture) => {
        const membership = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: membership.bandRoleId } });
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const global = await createGlobalCatalog(tx, fixture);
        await editCatalogFixture(tx, auth, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const otherIdentity = await editCatalogFixture(tx, other, { kind: "optInInstrument", globalPublicId: global.instrument.publicId });
        const first = (await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments[0]!;
        await editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId: first.publicId,
            patch: { name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "Band A" } } });
        expect((await readCatalogFixture(await readSnapshot(tx, auth), auth)).instruments[0]?.name).toBe("Band A");
        expect((await readCatalogFixture(await readSnapshot(tx, other), other)).instruments[0]?.name).toBe("Flute");
        await expect(editCatalogFixture(tx, auth, { kind: "updateInstrument", publicId: parsePublicId<"Instrument">(otherIdentity.publicId), patch: { sortOrder: 9 } })).rejects.toThrow();
        await tx.bandUser.update({ where: { id: membership.id }, data: { isDeleted: true } });
        await expect(editCatalogFixture(tx, await auth.refresh(tx), { kind: "updateInstrument", publicId: first.publicId, patch: { sortOrder: 3 } })).rejects.toThrow();
        await tx.bandUser.update({ where: { id: membership.id }, data: { isDeleted: false, bandRoleId: null } });
        await expect(editCatalogFixture(tx, await auth.refresh(tx), { kind: "updateInstrument", publicId: first.publicId, patch: { sortOrder: 3 } })).rejects.toThrow();
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
            const command: FixtureCatalogEdit = { kind: "createGroup", name: "Rolled back", description: "", localeTag: "en-US", color: null, sortOrder: 0 };
            await editCatalogFixture(tx, auth, command);
            throw failure;
        }, { timeout: 30_000 })).rejects.toBe(failure);
        expect(await database.bandInstrumentFunctionalGroup.count({ where: { bandId } })).toBe(0);
        expect(await database.bandDynamicLocalizedStringValue.count({ where: { bandId } })).toBe(0);
        expect(await database.user.count({ where: { email: "rollback-instrument@test.invalid" } })).toBe(0);
    });
});
