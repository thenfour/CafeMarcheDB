import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { xBandSongTag, bandSongTagView } from "src/core/db3/shared/entities/song/bandSongTagViews";
import { xSong } from "src/core/db3/db3";
import { deriveViewContract } from "src/core/db3/shared/core/db3ViewContract";
import { defineView } from "src/core/db3/shared/core/db3View";
import { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryTable, queryView, DB3PaginatedQueryCore } from "src/core/db3/server/db3QueryCore";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const narrowSelection = Prisma.validator<Prisma.BandSongTagDefaultArgs>()({ select: { publicId: true } });
const narrowContract = deriveViewContract(xBandSongTag, narrowSelection);
const narrowView = defineView({ viewID: "BandSongTag_TestIdentity", entity: xBandSongTag,
    selection: narrowContract.prismaSelection, dtoSchema: narrowContract.dtoSchema, hydrate: narrowContract.hydrate });
const text = (value: string, localeTag = "en-US") => ({ kind: "set", stringPublicId: null, localeTag, value });
const readSnapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) =>
    bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
    loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));

describe.skipIf(!settingsMysqlTestUrl)("second DB3 catalog on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_songs } });
            await tx.bandRolePermission.createMany({ data: { publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id }, skipDuplicates: true });
            await work(tx, fixture);
        });

    it("uses generated CRUD, inherited codecs, shared opt-in and ordinary audits", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: {
            publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Global tag",
        } } } });
        const description = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format: "Markdown" } });
        const source = await tx.globalSongTag.create({ data: { publicId: generatePublicId(), nameId: name.id,
            descriptionId: description.id, sortOrder: 7, color: "blue", group: "Wind" } });
        const rows = createCommandRowServices(auth, tx);
        const opted = await rows.optIn(xBandSongTag, source.publicId);
        const auditCount = await tx.change.count({ where: { userId: fixture.user.id } });
        expect((await rows.optIn(xBandSongTag, source.publicId)).publicId).toBe(opted.publicId);
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBe(auditCount);
        const result = await queryView({ cmdbQueryContext: "second catalog fixture", view: bandSongTagView, filter: { publicIds: [opted.publicId] } }, auth, await readSnapshot(tx, auth));
        const client = bandSongTagView.hydrate(result.items[0]!, new DB3ReferenceStore());
        expect(client.color).toMatchObject({ value: { id: "blue" }, override: null, inheritedValue: { id: "blue" } });
        expect(client.name).toMatchObject({ value: "Global tag" });
        expect(xBandSongTag.fields.name.codec.encode(client.name)).toBeUndefined();
        await executeCatalogCrud(tx, auth, bandSongTagView, {
            color: xBandSongTag.fields.color.codec.encode(client.color),
            sortOrder: xBandSongTag.fields.sortOrder.codec.encode(client.sortOrder), isHidden: false,
        }, client.publicId);
        expect(await tx.bandSongTag.findUniqueOrThrow({ where: { publicId: client.publicId } })).toMatchObject({ nameId: null, color: null, sortOrder: null });
        await tx.globalSongTag.update({ where: { id: source.id }, data: { color: "red", sortOrder: 13 } });
        const updated = await queryView({ cmdbQueryContext: "second catalog fixture", view: bandSongTagView, filter: { publicIds: [opted.publicId] } }, auth, await readSnapshot(tx, auth));
        expect(updated.items[0]).toMatchObject({ color: "red", sortOrder: 13 });
        const created = await executeCatalogCrud(tx, auth, bandSongTagView, { name: text("Local tag"), description: text("", "fr-BE"), color: "blue", sortOrder: 3 });
        expect(await tx.bandSongTag.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ bandId: fixture.bands[0]!.id, globalSongTagId: null, color: "blue", sortOrder: 3 });
        expect(await tx.change.count({ where: { userId: fixture.user.id } })).toBeGreaterThan(auditCount);
    }));

    it("matches resolved text across fields, then sorts, counts and pages independently of the DTO selection", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const identities: string[] = [];
        for (const group of ["Wind", "Wind", "Brass"]) {
            const created = await executeCatalogCrud(tx, auth, bandSongTagView, { name: text("Fl\u00fbte", "fr-BE"), group, sortOrder: 0 });
            identities.push(String(created.identity));
            const row = await tx.bandSongTag.findUniqueOrThrow({ where: { publicId: String(created.identity) }, include: { name: true } });
            await executeCatalogCrud(tx, auth, bandSongTagView, { name: { ...text("Fluit", "nl-BE"), stringPublicId: row.name!.publicId } }, created.identity);
        }
        const context = { cmdbQueryContext: "second catalog fixture", routeLocale: "en-US", browserLanguages: ["fr-BE", "nl-BE"] };
        const table = { tableID: xBandSongTag.tableID, tableName: xBandSongTag.tableName, viewID: bandSongTagView.viewID };
        const filter = { quickFilterValues: ["FLUT", "WIND"] };
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
        expect((await queryTable({ ...context, browserLanguages: ["nl-BE", "fr-BE"], table, filter: { quickFilterValues: ["flui", "wind"] }, orderBy: undefined }, auth, await readSnapshot(tx, auth))).items).toHaveLength(2);
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: fixture.bands[0]!.id, localeId: fixture.frenchId } } });
        expect((await queryTable({ ...context, table, filter, orderBy: undefined }, auth, await readSnapshot(tx, auth))).items).toEqual([]);
    }));

    it("enforces ownership, visibility, fresh grants and field validation through the generic APIs", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const created = await executeCatalogCrud(tx, auth, bandSongTagView, { name: text("Owned tag"), sortOrder: 0 });
        await expect(executeCatalogCrud(tx, other, bandSongTagView, { sortOrder: 1 }, created.identity)).rejects.toThrow();
        expect((await queryView({ cmdbQueryContext: "second catalog fixture", view: bandSongTagView, filter: { publicIds: [parsePublicId<"SongTag">(String(created.identity))] } }, other, await readSnapshot(tx, other))).items).toEqual([]);
        for (const patch of [{ color: "invalid-color" }, { sortOrder: 1.5 }, { indicator: "x".repeat(192) }, { bandId: fixture.bands[1]!.id }, { globalSongTagId: 1 }, { globalSongTag: generatePublicId() }]) {
            await expect(executeCatalogCrud(tx, auth, bandSongTagView, patch, created.identity)).rejects.toThrow();
        }
        await executeCatalogCrud(tx, auth, bandSongTagView, { isHidden: true }, created.identity);
        expect((await queryView({ cmdbQueryContext: "second catalog fixture", view: bandSongTagView, filter: {} }, auth, await readSnapshot(tx, auth))).items).toEqual([]);
        expect((await queryView({ cmdbQueryContext: "second catalog fixture", view: bandSongTagView, filter: { tableParams: { includeHidden: true } } }, auth, await readSnapshot(tx, auth))).items).toHaveLength(1);
        await executeCatalogCrud(tx, auth, bandSongTagView, { isHidden: false }, created.identity);
        expect((await queryView({ cmdbQueryContext: "second catalog fixture", view: bandSongTagView, filter: {} }, auth, await readSnapshot(tx, auth))).items).toHaveLength(1);
        await executeCatalogCrud(tx, auth, bandSongTagView, { isHidden: true }, created.identity);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { bandRoleId: null } });
        await expect(queryView({ cmdbQueryContext: "second catalog fixture", view: bandSongTagView, filter: { tableParams: { includeHidden: true } } }, auth, await readSnapshot(tx, auth))).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, bandSongTagView, { isHidden: false }, created.identity)).rejects.toThrow();
        // Selected-band grants must not cross into a legacy row service composed by a new command.
        await expect(createCommandRowServices(auth, tx).insert(xSong, {})).rejects.toThrow();
    }));
});
