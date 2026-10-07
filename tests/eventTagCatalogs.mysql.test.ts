import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { xBandEventTag, bandEventTagView, xGlobalEventTag, globalEventTagView } from "src/core/db3/shared/entities/event/eventTagCatalogs";
import { loadDashboardCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { eventTagDashboardView, createDashboardReferenceStore } from "src/core/db3/shared/references/dashboardReferences";
import { xSong } from "src/core/db3/db3";
import { deriveViewContract } from "src/core/db3/shared/core/db3ViewContract";
import { defineView } from "src/core/db3/shared/core/db3View";
import { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryTable, queryView, DB3PaginatedQueryCore } from "src/core/db3/server/db3QueryCore";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const narrowSelection = Prisma.validator<Prisma.BandEventTagDefaultArgs>()({ select: { publicId: true } });
const narrowContract = deriveViewContract(xBandEventTag, narrowSelection);
const narrowView = defineView({ viewID: "BandEventTag_TestIdentity", entity: xBandEventTag,
    selection: narrowContract.prismaSelection, dtoSchema: narrowContract.dtoSchema, hydrate: narrowContract.hydrate });
const text = (value: string, localeTag = "en-US") => ({ kind: "set", stringPublicId: null, localeTag, value });
const readSnapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) =>
    bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
    loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));

describe.skipIf(!settingsMysqlTestUrl)("event tag catalog on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_events } });
            await tx.bandRolePermission.createMany({ data: { publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id }, skipDuplicates: true });
            await work(tx, fixture);
        });

    async function catalogManager(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_catalogs } });
        const role = await tx.globalRole.create({ data: {
            publicId: generatePublicId(),
            name: { create: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Tag manager" } } } },
            permissions: { create: { publicId: generatePublicId(), permissionId: permission.id } },
        } });
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name: "Tag manager", email: "tags@test.invalid", globalRoleId: role.id } });
        return { role, auth: await loadAuthorizationForUser(user, tx) };
    }

    it("edits global labels and frontpage visibility only in platform context with fresh grants", () => withFixture(async (tx, fixture) => {
        const { role, auth } = await catalogManager(tx, fixture);
        expect(auth.hasPermission(Permission.manage_global_localization)).toBe(false);
        const created = await executeCatalogCrud(tx, auth, globalEventTagView, { name: text("Public"), description: text("**Public event**"), visibleOnFrontpage: true, sortOrder: 2, color: "orange" });
        const read = async (locale = "en-US") => (await queryView({ view: globalEventTagView, routeLocale: locale, filter: {}, cmdbQueryContext: "shared tags" }, auth, await readSnapshot(tx, auth))).items[0]!;
        const initial = await read();
        expect(initial).toMatchObject({ name: "Public", visibleOnFrontpage: true });
        expect(initial).not.toHaveProperty("nameId");
        expect(initial).not.toHaveProperty("id");
        await executeCatalogCrud(tx, auth, globalEventTagView, { name: { ...text("Public fran\u00e7ais", "fr-BE"), stringPublicId: initial.nameStringPublicId } }, created.identity);
        expect(await read("fr-BE")).toMatchObject({ name: "Public fran\u00e7ais", description: "**Public event**" });
        expect(await read()).toMatchObject({ name: "Public" });
        await executeCatalogCrud(tx, auth, globalEventTagView, { name: { ...text("", "fr-BE"), stringPublicId: initial.nameStringPublicId } }, created.identity);
        expect(await read("fr-BE")).toMatchObject({ name: "", nameResolution: { reason: "exact" } });
        expect(await tx.bandDynamicLocalizedStringValue.count()).toBe(0);
        expect(await tx.change.count({ where: { userId: auth.userId, table: "DynamicLocalizedStringValue" } })).toBe(4);
        const bandAuth = await authorize(tx, fixture);
        await expect(executeCatalogCrud(tx, bandAuth, globalEventTagView, { visibleOnFrontpage: false }, created.identity)).rejects.toThrow();
        const unscoped = await loadAuthorizationForUser(fixture.user, tx);
        await expect(executeCatalogCrud(tx, unscoped, globalEventTagView, { visibleOnFrontpage: false }, created.identity)).rejects.toThrow();
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: role.id } });
        await expect(executeCatalogCrud(tx, auth, globalEventTagView, { visibleOnFrontpage: false }, created.identity)).rejects.toThrow();
        expect(await tx.globalEventTag.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ visibleOnFrontpage: true });
    }));

    it("resolves band translations, intentional blanks, inheritance and fresh dashboard snapshots", () => withFixture(async (tx, fixture) => {
        const manager = await catalogManager(tx, fixture);
        const created = await executeCatalogCrud(tx, manager.auth, globalEventTagView, { name: text("Global tag"), description: text("Shared details"), color: "blue", sortOrder: 7, visibleOnFrontpage: true });
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const opted = await createCommandRowServices(auth, tx).optIn(xBandEventTag, String(created.identity));
        const read = async (routeLocale = "fr-BE") => (await queryView({ view: bandEventTagView, routeLocale, filter: {}, cmdbQueryContext: "band tag translations" }, auth, await readSnapshot(tx, auth))).items[0]!;
        expect(await read()).toMatchObject({ name: "Global tag", visibleOnFrontpage: true, color: "blue" });
        await executeCatalogCrud(tx, auth, bandEventTagView, { name: text("Local fran\u00e7ais", "fr-BE"), color: "red", sortOrder: 0 }, opted.publicId);
        const translated = await read();
        expect(translated).toMatchObject({ name: "Local fran\u00e7ais", color: "red", sortOrder: 0 });
        await executeCatalogCrud(tx, auth, bandEventTagView, { name: { ...text("", "fr-BE"), stringPublicId: translated.nameStringPublicId } }, opted.publicId);
        expect(await read()).toMatchObject({ name: "" });
        await executeCatalogCrud(tx, auth, bandEventTagView, { name: { kind: "inherit", stringPublicId: translated.nameStringPublicId }, color: null, sortOrder: null }, opted.publicId);
        expect(await read()).toMatchObject({ name: "Global tag", color: "blue", sortOrder: 7 });
        await executeCatalogCrud(tx, manager.auth, globalEventTagView, { visibleOnFrontpage: false }, created.identity);
        const catalogs = await loadDashboardCatalogs(await readSnapshot(tx, auth), auth, { routeLocale: "en-US" });
        const display = eventTagDashboardView.hydrate(catalogs.eventTag[0]!, createDashboardReferenceStore());
        expect(display).toMatchObject({ name: "Global tag", visibleOnFrontpage: false, color: { id: "blue" } });
        expect((await loadDashboardCatalogs(await readSnapshot(tx, other), other, {})).eventTag).toEqual([]);
        const custom = await executeCatalogCrud(tx, auth, bandEventTagView, { name: text("Custom") });
        await expect(executeCatalogCrud(tx, auth, bandEventTagView, { name: { kind: "inherit", stringPublicId: null } }, custom.identity)).rejects.toThrow();
    }));

    it("keeps hidden assignments and supports authorized hard deletion without crossing band boundaries", () => withFixture(async (tx, fixture) => {
        const manager = await catalogManager(tx, fixture);
        const global = await executeCatalogCrud(tx, manager.auth, globalEventTagView, { name: text("Shared"), description: text("") });
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const opted = await createCommandRowServices(auth, tx).optIn(xBandEventTag, String(global.identity));
        const tag = await tx.bandEventTag.findUniqueOrThrow({ where: { publicId: opted.publicId } });
        const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, name: "Concert", revision: 1 } });
        await tx.eventTagAssignment.create({ data: { publicId: generatePublicId(), eventId: event.id, bandEventTagId: tag.id } });
        await executeCatalogCrud(tx, auth, bandEventTagView, { isHidden: true }, opted.publicId);
        expect(await tx.eventTagAssignment.count({ where: { bandEventTagId: tag.id } })).toBe(1);
        await expect(createCommandRowServices(other, tx).delete(xBandEventTag, opted.publicId, "hard")).rejects.toThrow();
        await expect(createCommandRowServices(manager.auth, tx).delete(xGlobalEventTag, xGlobalEventTag.parseIdentity(global.identity), "hard")).rejects.toThrow();
        await createCommandRowServices(auth, tx).delete(xBandEventTag, opted.publicId, "hard");
        expect(await tx.eventTagAssignment.count({ where: { bandEventTagId: tag.id } })).toBe(0);
        expect(await tx.event.count({ where: { id: event.id } })).toBe(1);
        await createCommandRowServices(manager.auth, tx).delete(xGlobalEventTag, xGlobalEventTag.parseIdentity(global.identity), "hard");
        expect(await tx.globalEventTag.count({ where: { publicId: String(global.identity) } })).toBe(0);
        expect(await tx.change.count({ where: { table: "bandEventTag", action: "delete", userId: auth.userId } })).toBe(1);
    }));

    it("uses generated CRUD, inherited codecs, shared opt-in and ordinary audits", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: {
            publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Global tag",
        } } } });
        const description = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format: "Markdown" } });
        const source = await tx.globalEventTag.create({ data: { publicId: generatePublicId(), nameId: name.id,
            descriptionId: description.id, sortOrder: 7, color: "blue", visibleOnFrontpage: true } });
        const rows = createCommandRowServices(auth, tx);
        const opted = await rows.optIn(xBandEventTag, source.publicId);
        const auditCount = await tx.change.count({ where: { userId: fixture.user.id } });
        expect((await rows.optIn(xBandEventTag, source.publicId)).publicId).toBe(opted.publicId);
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBe(auditCount);
        const result = await queryView({ cmdbQueryContext: "event tag fixture", view: bandEventTagView, filter: { publicIds: [opted.publicId] } }, auth, await readSnapshot(tx, auth));
        const client = bandEventTagView.hydrate(result.items[0]!, new DB3ReferenceStore());
        expect(client.color).toMatchObject({ value: { id: "blue" }, override: null, inheritedValue: { id: "blue" } });
        expect(client.name).toMatchObject({ value: "Global tag" });
        expect(client.visibleOnFrontpage).toBe(true);
        expect(xBandEventTag.fields.name.codec.encode(client.name)).toBeUndefined();
        await executeCatalogCrud(tx, auth, bandEventTagView, {
            color: xBandEventTag.fields.color.codec.encode(client.color),
            sortOrder: xBandEventTag.fields.sortOrder.codec.encode(client.sortOrder), isHidden: false,
        }, client.publicId);
        expect(await tx.bandEventTag.findUniqueOrThrow({ where: { publicId: client.publicId } })).toMatchObject({ nameId: null, color: null, sortOrder: null });
        await tx.globalEventTag.update({ where: { id: source.id }, data: { color: "red", sortOrder: 13 } });
        const updated = await queryView({ cmdbQueryContext: "event tag fixture", view: bandEventTagView, filter: { publicIds: [opted.publicId] } }, auth, await readSnapshot(tx, auth));
        expect(updated.items[0]).toMatchObject({ color: "red", sortOrder: 13 });
        const created = await executeCatalogCrud(tx, auth, bandEventTagView, { name: text("Local tag"), description: text("", "fr-BE"), color: "blue", sortOrder: 3 });
        expect(await tx.bandEventTag.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ bandId: fixture.bands[0]!.id, globalEventTagId: null, color: "blue", sortOrder: 3 });
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBeGreaterThan(auditCount);
    }));

    it("matches resolved text across fields, then sorts, counts and pages independently of the DTO selection", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const identities: string[] = [];
        for (const group of ["Wind", "Wind", "Brass"]) {
            const created = await executeCatalogCrud(tx, auth, bandEventTagView, { name: text(group == "Brass" ? "Hautbois" : "Fl\u00fbte", "fr-BE"), description: text(group), sortOrder: 0 });
            identities.push(String(created.identity));
            const row = await tx.bandEventTag.findUniqueOrThrow({ where: { publicId: String(created.identity) }, include: { name: true } });
            await executeCatalogCrud(tx, auth, bandEventTagView, { name: { ...text(group == "Brass" ? "Hobo" : "Fluit", "nl-BE"), stringPublicId: row.name!.publicId } }, created.identity);
        }
        const context = { cmdbQueryContext: "event tag fixture", routeLocale: "en-US", browserLanguages: ["fr-BE", "nl-BE"] };
        const table = { tableID: xBandEventTag.tableID, tableName: xBandEventTag.tableName, viewID: bandEventTagView.viewID };
        const filter = { quickFilterValues: ["FLUT"] };
        const expected = identities.slice(0, 2).sort();
        const first = await DB3PaginatedQueryCore({ ...context, table, filter, orderBy: { name: "asc" }, skip: 0, take: 1 }, auth, await readSnapshot(tx, auth));
        const second = await DB3PaginatedQueryCore({ ...context, table, filter, orderBy: { name: "asc" }, skip: 1, take: 1 }, auth, await readSnapshot(tx, auth));
        expect(first).toMatchObject({ count: 2, hasMore: true });
        expect(second).toMatchObject({ count: 2, hasMore: false });
        expect([first.items[0]!.publicId, second.items[0]!.publicId]).toEqual(expected);
        console.info("[db3-catalog-fixture]", { rows: identities.length, matched: first.count,
            firstPageMillis: first.executionTimeMillis, secondPageMillis: second.executionTimeMillis });
        const narrow = await queryView({ ...context, view: narrowView, filter, take: 1 }, auth, await readSnapshot(tx, auth));
        expect(narrow.items).toEqual([{ publicId: expected[0] }]);
        expect((await queryTable({ ...context, browserLanguages: ["nl-BE", "fr-BE"], table, filter, orderBy: undefined }, auth, await readSnapshot(tx, auth))).items).toEqual([]);
        expect((await queryTable({ ...context, browserLanguages: ["nl-BE", "fr-BE"], table, filter: { quickFilterValues: ["flui"] }, orderBy: undefined }, auth, await readSnapshot(tx, auth))).items).toHaveLength(2);
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: fixture.bands[0]!.id, localeId: fixture.frenchId } } });
        expect((await queryTable({ ...context, table, filter, orderBy: undefined }, auth, await readSnapshot(tx, auth))).items).toEqual([]);
    }));

    it("enforces ownership, visibility, fresh grants and field validation through the generic APIs", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const created = await executeCatalogCrud(tx, auth, bandEventTagView, { name: text("Owned tag"), sortOrder: 0 });
        await expect(executeCatalogCrud(tx, other, bandEventTagView, { sortOrder: 1 }, created.identity)).rejects.toThrow();
        expect((await queryView({ cmdbQueryContext: "event tag fixture", view: bandEventTagView, filter: { publicIds: [parsePublicId<"EventTag">(String(created.identity))] } }, other, await readSnapshot(tx, other))).items).toEqual([]);
        for (const patch of [{ color: "invalid-color" }, { sortOrder: 1.5 }, { visibleOnFrontpage: true }, { bandId: fixture.bands[1]!.id }, { globalEventTagId: 1 }, { globalEventTag: generatePublicId() }]) {
            await expect(executeCatalogCrud(tx, auth, bandEventTagView, patch, created.identity)).rejects.toThrow();
        }
        await executeCatalogCrud(tx, auth, bandEventTagView, { isHidden: true }, created.identity);
        expect((await queryView({ cmdbQueryContext: "event tag fixture", view: bandEventTagView, filter: {} }, auth, await readSnapshot(tx, auth))).items).toEqual([]);
        expect((await queryView({ cmdbQueryContext: "event tag fixture", view: bandEventTagView, filter: { tableParams: { includeHidden: true } } }, auth, await readSnapshot(tx, auth))).items).toHaveLength(1);
        await executeCatalogCrud(tx, auth, bandEventTagView, { isHidden: false }, created.identity);
        expect((await queryView({ cmdbQueryContext: "event tag fixture", view: bandEventTagView, filter: {} }, auth, await readSnapshot(tx, auth))).items).toHaveLength(1);
        await executeCatalogCrud(tx, auth, bandEventTagView, { isHidden: true }, created.identity);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { bandRoleId: null } });
        await expect(queryView({ cmdbQueryContext: "event tag fixture", view: bandEventTagView, filter: { tableParams: { includeHidden: true } } }, auth, await readSnapshot(tx, auth))).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, bandEventTagView, { isHidden: false }, created.identity)).rejects.toThrow();
        // Selected-band grants must not cross into a legacy row service composed by a new command.
        await expect(createCommandRowServices(auth, tx).insert(xSong, {})).rejects.toThrow();
    }));
});
