import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { fileDetailView, xFile } from "src/core/db3/db3";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { readFileDetailPage } from "src/core/db3/server/fileDetailPage";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { DiscreteCriterionFilterType as Behavior, type GetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepareFiles(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.view_files, Permission.upload_files,
        Permission.access_file_landing_page, Permission.visibility_members]);
    const text = (english: string, french: string) => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: english },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: french },
        ] },
    } });
    const firstName = await text("Score", "Partition");
    const description = await text("Shared description", "Description partagee");
    const globalTag = await tx.globalFileTag.create({ data: { publicId: generatePublicId(), nameId: firstName.id,
        descriptionId: description.id, sortOrder: 7, color: "green" } });
    const firstTag = await tx.bandFileTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, globalFileTagId: globalTag.id } });
    const secondName = await text("Recording", "Enregistrement");
    const secondTag = await tx.bandFileTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, nameId: secondName.id, sortOrder: 2 } });
    const hiddenTag = await tx.bandFileTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, nameId: secondName.id, isHidden: true } });
    const foreignTag = await tx.bandFileTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, globalFileTagId: globalTag.id } });
    const trumpetName = await text("Trumpet", "Trompette");
    const drumName = await text("Drums", "Percussion");
    const firstInstrument = await tx.bandInstrument.update({ where: { id: c.instrument.id }, data: { nameId: trumpetName.id, descriptionId: description.id, sortOrder: 7 } });
    const secondInstrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
        functionalGroupId: c.instrument.functionalGroupId, nameId: drumName.id, sortOrder: 2 } });
    const hiddenInstrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
        functionalGroupId: c.instrument.functionalGroupId, nameId: drumName.id, isHidden: true } });
    const foreignGroup = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
    const foreignInstrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id,
        functionalGroupId: foreignGroup.id, nameId: trumpetName.id } });
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const files = await Promise.all(["Alpha", "Bravo", "Charlie", "Delta"].map((name, index) => tx.file.create({ data: {
        publicId: generatePublicId(), bandId: c.band.id, fileLeafName: name + ".pdf", description: index === 0 ? "rehearsal notes" : "",
        uploadedByUserId: fixture.user.id, uploadedAt: new Date("2026-10-09T12:00:00Z"), storedLeafName: generatePublicId(),
        visiblePermissionId: visibility.id, mimeType: index % 2 === 0 ? "application/pdf" : "audio/wav", sizeBytes: 100 + index,
        tags: { create: (index === 0 ? [firstTag] : index === 1 ? [secondTag] : index === 2 ? [firstTag, secondTag] : [hiddenTag]).map(tag => ({ publicId: generatePublicId(), bandFileTagId: tag.id })) },
        taggedInstruments: { create: (index === 0 ? [firstInstrument] : index === 1 ? [secondInstrument] : index === 2 ? [firstInstrument, secondInstrument] : [hiddenInstrument]).map(instrument => ({ publicId: generatePublicId(), bandInstrumentId: instrument.id })) },
    } })));
    const foreign = await tx.file.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id,
        fileLeafName: "Foreign.pdf", storedLeafName: generatePublicId(), description: "foreign secret", uploadedAt: new Date(),
        uploadedByUserId: fixture.user.id, visiblePermissionId: visibility.id } });
    const privateFile = await tx.file.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
        fileLeafName: "Private.pdf", storedLeafName: generatePublicId(), description: "private secret", uploadedAt: new Date(), uploadedByUserId: fixture.admin.id } });
    const deletedFile = await tx.file.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
        fileLeafName: "Deleted.pdf", storedLeafName: generatePublicId(), description: "deleted secret", uploadedAt: new Date(),
        uploadedByUserId: fixture.user.id, visiblePermissionId: visibility.id, isDeleted: true } });
    const snapshot = () => bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
    const query = (patch: Partial<GetSearchResultsInput> = {}): GetSearchResultsInput => ({
        bandPublicId: c.args.bandPublicId, tableID: "File", viewID: "File_Search", offset: 0, take: 20, quickFilter: "",
        sort: [{ db3Column: "fileLeafName", direction: "asc" }], discreteCriteria: [
            { db3Column: "tags", behavior: Behavior.alwaysMatch, options: [] },
            { db3Column: "taggedInstruments", behavior: Behavior.alwaysMatch, options: [] },
        ], ...patch,
    });
    const search = async (patch: Partial<GetSearchResultsInput> = {}) => GetSearchResultsCore(query(patch), c.auth, await snapshot());
    const page = async (fileId: string) => readFileDetailPage(await snapshot(), c.auth,
        { bandPublicId: c.args.bandPublicId }, xFile.parseIdentity(fileId));
    return { ...c, text, firstTag, secondTag, hiddenTag, foreignTag, firstInstrument, secondInstrument,
        hiddenInstrument, foreignInstrument, files, foreign, privateFile, deletedFile, snapshot, query, search, page };
}

describe.skipIf(!settingsMysqlTestUrl)("restored File search and detail on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(async () => {
        if (database) {
            await initializeAccessControl(database);
        }
    }, 30_000);
    afterAll(async () => { await database?.$disconnect(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => {
        if (!database) {
            throw new Error("A disposable File search database is required.");
        }
        return withSettingsMysqlFixture(database, work);
    };

    it.each(["tag", "instrument"] as const)("matches authorized File %s names and preserves literal SQL metacharacters", kind => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        const name = await c.text("Globalneedle", "Sérénade100%_quote'\\end");
        if (kind === "tag") {
            await tx.globalFileTag.update({ where: { id: c.firstTag.globalFileTagId! }, data: { nameId: name.id } });
        } else {
            await tx.bandInstrument.update({ where: { id: c.firstInstrument.id }, data: { nameId: name.id } });
        }
        const names = async (quickFilter: string) => (await c.search({ quickFilter, routeLocale: "fr-BE" })).results.map(row => row.fileLeafName);
        expect(await names("serenade")).toEqual(["Alpha.pdf", "Charlie.pdf"]);
        expect(await names("100%")).toEqual(["Alpha.pdf", "Charlie.pdf"]);
        expect(await names("quote'\\end")).toEqual(["Alpha.pdf", "Charlie.pdf"]);
        expect(await names("1000%")).toEqual([]);
        expect(await names("Globalneedle")).toEqual([]);
        expect(await names("Alpha serenade")).toEqual(["Alpha.pdf"]);
        const override = await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(),
            bandId: c.band.id, stringId: name.id, localeId: fixture.englishId, indexedValue: "Bandfirstneedle" } });
        expect(await names("Bandfirstneedle")).toEqual(["Alpha.pdf", "Charlie.pdf"]);
        expect(await names("serenade")).toEqual([]);
        await tx.bandDynamicLocalizedStringValue.update({ where: { id: override.id }, data: { indexedValue: "" } });
        expect(await names("Bandfirstneedle")).toEqual([]);
        await tx.bandDynamicLocalizedStringValue.delete({ where: { id: override.id } });
        if (kind === "tag") {
            await tx.bandFileTag.update({ where: { id: c.firstTag.id }, data: { isHidden: true } });
        } else {
            await tx.bandInstrumentFunctionalGroup.update({ where: { id: c.firstInstrument.functionalGroupId }, data: { isHidden: true } });
        }
        expect(await names("serenade")).toEqual([]);
        expect(await names("Alpha")).toEqual(["Alpha.pdf"]);
    }));

    it("keeps results, counts, localized facets and public references in each band's snapshot", () => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        const result = await c.search();
        expect(result.results.map(file => file.fileLeafName)).toEqual(["Alpha.pdf", "Bravo.pdf", "Charlie.pdf", "Delta.pdf"]);
        expect(result.rowCount).toBe(4);
        expect(result.facets[0]!.items).toEqual([
            expect.objectContaining({ id: null, rowCount: 1 }),
            expect.objectContaining({ id: c.secondTag.publicId, label: "Recording", rowCount: 2 }),
            expect.objectContaining({ id: c.firstTag.publicId, label: "Score", rowCount: 2, color: "green", tooltip: "Shared description" }),
        ]);
        expect(result.facets[1]!.items.map(item => item.label)).toEqual([null, "Drums", "Trumpet"]);
        expect(result.results[3]).toMatchObject({ tags: [], taggedInstruments: [] });
        expect(JSON.stringify(result.results)).not.toMatch(/"(?:id|bandId|userId|email|phone|nameId|fileId)":/);
        expect(result.queryMetrics.every(metric => metric.query === "")).toBe(true);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: c.role.id } });
        const bandPublicId = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
        const other = await GetSearchResultsCore(c.query({ bandPublicId }), auth,
            await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
        expect(other.results.map(file => file.publicId)).toEqual([c.foreign.publicId]);
        expect(other.facets[0]!.items.map(item => item.id)).not.toContain(c.firstTag.publicId);
    }));

    for (const column of ["tags", "taggedInstruments"]) {
        it.each([
            { behavior: Behavior.hasSomeOf, indexes: [0], names: ["Alpha.pdf", "Charlie.pdf"] },
            { behavior: Behavior.hasAllOf, indexes: [0, 1], names: ["Charlie.pdf"] },
            { behavior: Behavior.doesntHaveAnyOf, indexes: [0], names: ["Bravo.pdf", "Delta.pdf"] },
            { behavior: Behavior.doesntHaveAllOf, indexes: [0, 1], names: ["Alpha.pdf", "Bravo.pdf", "Delta.pdf"] },
            { behavior: Behavior.hasAny, indexes: [], names: ["Alpha.pdf", "Bravo.pdf", "Charlie.pdf"] },
            { behavior: Behavior.hasNone, indexes: [], names: ["Delta.pdf"] },
            { behavior: Behavior.alwaysMatch, indexes: [], names: ["Alpha.pdf", "Bravo.pdf", "Charlie.pdf", "Delta.pdf"] },
        ])(`preserves ${column} operator $behavior`, ({ behavior, indexes, names }) => run(async (tx, fixture) => {
            const c = await prepareFiles(tx, fixture);
            const options = indexes.map(index => (column === "tags" ? [c.firstTag, c.secondTag] : [c.firstInstrument, c.secondInstrument])[index]!.publicId);
            const result = await c.search({ discreteCriteria: [{ db3Column: column, behavior, options }] });
            expect(result.results.map(file => file.fileLeafName)).toEqual(names);
            expect(result.rowCount).toBe(names.length);
            expect(result.facets[0]!.items.find(item => item.id === (column === "tags" ? c.firstTag : c.firstInstrument).publicId)?.rowCount).toBe(2);
        }));
    }

    it("combines authored text and identity filters and retains unselected-filter guidance", () => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        const result = await c.search({ quickFilter: "rehearsal", discreteCriteria: [
            { db3Column: "tags", behavior: Behavior.hasAllOf, options: [c.firstTag.publicId] },
            { db3Column: "taggedInstruments", behavior: Behavior.doesntHaveAnyOf, options: [c.secondInstrument.publicId] },
        ] });
        expect(result.results.map(file => file.fileLeafName)).toEqual(["Alpha.pdf"]);
        expect((await c.search({ quickFilter: "Partition Trompette" })).rowCount).toBe(0);
        const unselected = await c.search({ discreteCriteria: [{ db3Column: "tags", behavior: Behavior.hasSomeOf, options: [] }] });
        expect(unselected.rowCount).toBe(4);
        expect(unselected.filterQueryResult.errors).toEqual([{ column: "tags", error: "Select options to filter on" }]);
    }));

    it("preserves blanks, band-first fallback and ordered browser preferences", () => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        const blank = await c.text("Unused", "");
        await tx.bandFileTag.update({ where: { id: c.firstTag.id }, data: { nameId: blank.id } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: c.firstInstrument.nameId!,
            bandId: c.band.id, localeId: fixture.frenchId, indexedValue: "Cornet" } });
        const result = await c.search({ routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] });
        expect(result.facets[0]!.items.find(item => item.id === c.firstTag.publicId)).toMatchObject({ label: "", color: "green" });
        expect(result.facets[1]!.items.find(item => item.id === c.firstInstrument.publicId)?.label).toBe("Cornet");
        const english = await c.search({ browserLanguages: ["en-US"] });
        const french = await c.search({ browserLanguages: ["fr-CA", "en-US"] });
        expect(english.facets[0]!.items.find(item => item.id === c.secondTag.publicId)?.label).toBe("Recording");
        expect(french.facets[0]!.items.find(item => item.id === c.secondTag.publicId)?.label).toBe("Enregistrement");
    }));

    it.each([
        { column: "fileLeafName", descending: ["Delta.pdf", "Charlie.pdf", "Bravo.pdf", "Alpha.pdf"] },
        { column: "uploadedAt", descending: Array.from({ length: 4 }, () => "2026-10-09T12:00:00.000Z") },
        { column: "sizeBytes", descending: [103, 102, 101, 100] },
        { column: "mimeType", descending: ["audio/wav", "audio/wav", "application/pdf", "application/pdf"] },
    ] as const)("keeps $column sorting, stable ties and later-page totals", ({ column, descending }) => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        const sort = [{ db3Column: column, direction: "desc" as const }];
        const whole = await c.search({ sort });
        const ascending = await c.search({ sort: [{ db3Column: column, direction: "asc" }] });
        const values = (result: typeof whole) => result.results.map(file => {
            const value = file[column];
            return value instanceof Date ? value.toISOString() : value;
        });
        expect(values(whole)).toEqual(descending);
        expect(values(ascending)).toEqual([...descending].reverse());
        const first = await c.search({ take: 2, sort });
        const second = await c.search({ offset: 2, take: 2, sort });
        expect([...first.results, ...second.results]).toEqual(whole.results);
        expect(new Set(whole.results.map(file => file.publicId)).size).toBe(4);
        expect(first.rowCount).toBe(4);
        expect(second.rowCount).toBe(4);
        expect(first.facets).toEqual(second.facets);
    }));

    it("rejects hidden/foreign/forged references, unsupported columns and alternate views", () => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        for (const [column, ids] of [
            ["tags", [c.hiddenTag.publicId, c.foreignTag.publicId]],
            ["taggedInstruments", [c.hiddenInstrument.publicId, c.foreignInstrument.publicId]],
        ] as const) {
            for (const id of [...ids, generatePublicId(), 123]) {
                await expect(c.search({ discreteCriteria: [{ db3Column: column, behavior: Behavior.hasSomeOf, options: [id] }] })).rejects.toThrow();
            }
        }
        for (const patch of [{ bandPublicId: null }, { includeDeleted: true }, { viewID: "File_Editor" },
            { sort: [{ db3Column: "bandId", direction: "asc" as const }] }]) {
            await expect(c.search(patch)).rejects.toThrow();
        }
    }));

    it("protects page titles and related files independently of the visible parent", () => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        expect(await c.page(c.files[0]!.publicId)).toEqual({ title: "Alpha.pdf", fileId: c.files[0]!.publicId });
        for (const file of [c.foreign, c.privateFile, c.deletedFile]) {
            expect(await c.page(file.publicId)).toBeNull();
        }
        await tx.file.update({ where: { id: c.files[0]!.id }, data: { parentFileId: c.privateFile.id, previewFileId: c.deletedFile.id } });
        await tx.file.update({ where: { id: c.foreign.id }, data: { parentFileId: c.files[0]!.id } });
        const detail = await queryView({ view: fileDetailView, bandPublicId: c.args.bandPublicId, filter: { tableParams: { fileId: xFile.parseIdentity(c.files[0]!.publicId) } },
            cmdbQueryContext: "File detail privacy" }, c.auth, await c.snapshot());
        expect(detail.items[0]).toMatchObject({ parentFile: null, previewFile: null, childFiles: [] });
        expect(detail.items[0]).not.toHaveProperty("bandId");
    }));

    it("refreshes revoked grants, roleless/inactive/deleted/merged membership and band state", () => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        const snapshot = await c.snapshot();
        const read = () => GetSearchResultsCore(c.query(), c.auth, snapshot);
        // view_files is also a Public grant; revoke the grant that exposes these member-only rows.
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: grant.id } });
        expect((await read()).rowCount).toBe(0);
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: grant.id } });
        expect((await read()).rowCount).toBe(4);
        const landingGrant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.access_file_landing_page } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: landingGrant.id } });
        expect(await c.page(c.files[0]!.publicId)).toBeNull();
        expect((await read()).rowCount).toBe(4);
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: landingGrant.id } });
        for (const data of [{ bandRoleId: null }, { isDeleted: true }]) {
            await tx.bandUser.update({ where: { id: c.member.id }, data });
            expect((await read()).rowCount).toBe(0);
            await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: c.role.id, isDeleted: false } });
        }
        for (const data of [{ isDeleted: true }, { mergedIntoUserId: fixture.admin.id }]) {
            await tx.user.update({ where: { id: fixture.user.id }, data });
            await expect(read()).rejects.toThrow();
            await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: false, mergedIntoUserId: null } });
        }
        await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        await expect(read()).rejects.toThrow();
    }));

    it("requires selected-band authority for anonymous, outsider and platform principals", () => run(async (tx, fixture) => {
        const c = await prepareFiles(tx, fixture);
        const outsider = await tx.user.create({ data: { publicId: generatePublicId(), name: "Outsider", email: "file-outside@test.invalid" } });
        const anonymous = await loadAuthorizationForUser(null, tx, c.args.bandPublicId);
        await expect(GetSearchResultsCore(c.query(), anonymous,
            await bindDB3ReadSnapshot(tx, anonymous, { isolationLevel: "Serializable" }))).rejects.toThrow();
        const outsideAuth = await loadAuthorizationForUser(outsider, tx, c.args.bandPublicId);
        const outsideSnapshot = await bindDB3ReadSnapshot(tx, outsideAuth, { isolationLevel: "Serializable" });
        expect((await GetSearchResultsCore(c.query(), outsideAuth, outsideSnapshot)).rowCount).toBe(0);
        expect(await readFileDetailPage(outsideSnapshot, outsideAuth, c.args, xFile.parseIdentity(c.files[0]!.publicId))).toBeNull();
        const publicVisibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_public } });
        await tx.file.update({ where: { id: c.files[0]!.id }, data: { visiblePermissionId: publicVisibility.id } });
        expect((await GetSearchResultsCore(c.query(), outsideAuth, outsideSnapshot)).results.map(file => file.publicId)).toEqual([c.files[0]!.publicId]);
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(GetSearchResultsCore(c.query(), platform,
            await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }))).rejects.toThrow();
        const selected = await loadAuthorizationForUser(fixture.admin, tx, c.args.bandPublicId);
        const result = await GetSearchResultsCore(c.query(), selected,
            await bindDB3ReadSnapshot(tx, selected, { isolationLevel: "Serializable" }));
        expect(result.results.map(file => file.publicId)).not.toContain(c.foreign.publicId);
        expect(result.queryMetrics.some(metric => metric.query.length > 0)).toBe(true);
    }));
});
