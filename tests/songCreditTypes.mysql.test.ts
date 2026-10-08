import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadSharedCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { projectDB3ModelPublicIds } from "src/core/db3/server/db3PublicIds";
import { songCreditTypeEditorView, xSongCreditType } from "src/core/db3/shared/entities/song/songCreditTypes";
import { songCreditEditorView, songCreditUserView, songDetailView, songSearchView } from "src/core/db3/shared/entities/song/songViews";
import { xSongCredit } from "src/core/db3/shared/schema/song";
import { createDashboardReferenceStore, registerDashboardReferences, songCreditTypeDashboardView } from "src/core/db3/shared/references/dashboardReferences";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const text = (value: string, localeTag = "en-US", stringPublicId: string | null = null) => ({ kind: "set", value, localeTag, stringPublicId });

describe.skipIf(!settingsMysqlTestUrl)("shared song credit types on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

    async function catalogManager(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_global_catalogs } });
        const role = await tx.globalRole.create({ data: {
            publicId: generatePublicId(),
            name: { create: { publicId: generatePublicId(), values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Credit catalog manager" } } } },
            permissions: { create: { publicId: generatePublicId(), permissionId: permission.id } },
        } });
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name: "Credit manager", email: "credit-manager@test.invalid", globalRoleId: role.id,
            bandUsersByUser: { create: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id } },
        } });
        return { user, role, auth: await loadAuthorizationForUser(user, tx) };
    }

    async function readType(tx: Prisma.TransactionClient, auth: CMServerAuthorization, routeLocale: string) {
        const result = await queryView({ view: songCreditTypeEditorView, filter: {}, routeLocale, cmdbQueryContext: "credit type editor" }, auth, await snapshot(tx, auth));
        const row = result.items[0];
        if (!row) {
            throw new Error("Credit type fixture is missing.");
        }
        return row;
    }

    it("creates, edits and deletes global types with explicit writing locales and translation audits", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        expect(auth.hasPermission(Permission.manage_global_localization)).toBe(false);
        expect(() => xSongCreditType.createInsertModelFromString!("Composer")).toThrow("writing locale");
        const created = await executeCatalogCrud(tx, auth, songCreditTypeEditorView,
            xSongCreditType.createInsertModelFromString!("Composer", { localeTag: "en-US" }));
        const english = await readType(tx, auth, "en-US");
        await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("Compositeur", "fr-BE", english.nameStringPublicId), color: "green" }, created.identity);
        const french = await readType(tx, auth, "fr-BE");
        expect(french).toMatchObject({ name: "Compositeur", description: "", descriptionResolution: { localeTag: "en-US" } });
        expect(await readType(tx, auth, "en-US")).toMatchObject({ name: "Composer" });
        const editor = songCreditTypeEditorView.hydrate(french, createDashboardReferenceStore());
        expect(editor.name).toMatchObject({ value: "Compositeur", stringPublicId: english.nameStringPublicId });
        expect(xSongCreditType.getRowInfo(editor)).toMatchObject({ name: "Compositeur", color: { id: "green" } });
        expect(french).not.toHaveProperty("nameId");
        expect(french).not.toHaveProperty("id");
        expect(await tx.bandDynamicLocalizedStringValue.count()).toBe(0);
        expect(await tx.change.count({ where: { table: "DynamicLocalizedStringValue", userId: auth.userId } })).toBe(3);
        await createCommandRowServices(auth, tx).delete(xSongCreditType, xSongCreditType.parseIdentity(created.identity), "hard");
        expect(await tx.songCreditType.count()).toBe(0);
    }));

    it("filters, sorts and pages resolved localized names", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("Alpha"), description: text(""), sortOrder: 1 });
        const second = await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("Zulu"), description: text(""), sortOrder: 1 });
        const rows = await queryView({ view: songCreditTypeEditorView, filter: {}, cmdbQueryContext: "credit types" }, auth, await snapshot(tx, auth));
        for (const row of rows.items) {
            await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text(row.publicId === second.identity ? "Alpha local" : "Zulu local", "fr-BE", row.nameStringPublicId) }, row.publicId);
        }
        const table = { tableID: songCreditTypeEditorView.tableID, tableName: songCreditTypeEditorView.tableName, viewID: songCreditTypeEditorView.viewID };
        const page = await DB3PaginatedQueryCore({ table, routeLocale: "fr-BE", filter: { quickFilterValues: ["local"] }, orderBy: { name: "asc" }, skip: 0, take: 1, cmdbQueryContext: "localized credit type page" }, auth, await snapshot(tx, auth));
        expect(page.count).toBe(2);
        expect(page.items).toEqual([expect.objectContaining({ publicId: second.identity, name: "Alpha local" })]);
    }));

    it("delivers public defaults, band overrides and intentional blanks through dashboard references", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        const created = await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("Composer"), description: text("**Credit**") });
        const type = await tx.songCreditType.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
        for (const [index, band] of fixture.bands.entries()) {
            await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: type.nameId, localeId: fixture.frenchId, bandId: band.id, indexedValue: index === 0 ? "Auteur" : "" } });
        }
        const visitor = await loadAuthorizationForUser(null, tx);
        const first = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        const second = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        for (const [reader, name] of [[visitor, "Composer"], [first, "Auteur"], [second, ""]] as const) {
            const catalogs = await loadSharedCatalogs(await snapshot(tx, reader), reader, { routeLocale: "fr-BE" });
            expect(catalogs.songCreditType[0]).toMatchObject({ name, description: "**Credit**", descriptionResolution: { localeTag: "en-US" } });
            expect(songCreditTypeDashboardView.hydrate(catalogs.songCreditType[0]!, createDashboardReferenceStore()).name).toBe(name);
        }
        const english = await readType(tx, auth, "en-US");
        await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("", "fr-BE", english.nameStringPublicId) }, created.identity);
        expect(await readType(tx, visitor, "fr-BE")).toMatchObject({ name: "", nameResolution: { scope: "global", reason: "exact" } });
    }));

    it("hydrates credit editor, profile, detail and search captions from the same dashboard snapshot", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        const created = await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("Composer"), description: text(""), color: "green" });
        const type = await tx.songCreditType.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: type.nameId, localeId: fixture.frenchId, bandId: fixture.bands[0]!.id, indexedValue: "Auteur" } });
        const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, name: "A tune", description: "" } });
        const credit = await tx.songCredit.create({ data: { publicId: generatePublicId(), songId: song.id, typeId: type.id, userId: fixture.user.id, year: "2026", comment: "Credit" } });
        const person = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const reader = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        const catalogs = await loadSharedCatalogs(await snapshot(tx, reader), reader, { routeLocale: "fr-BE" });
        const references = createDashboardReferenceStore();
        registerDashboardReferences(references, { songCreditType: catalogs.songCreditType.map(dto => songCreditTypeDashboardView.hydrate(dto, references)) });
        for (const view of [songCreditEditorView, songCreditUserView]) {
            const raw = await tx.songCredit.findUniqueOrThrow({ ...view.getSelectionArgs({ filter: {}, auth: reader }), where: { id: credit.id } });
            // These conversions validate payloads; general song/credit reads remain guarded.
            const dto = view.parseDto(projectDB3ModelPublicIds(xSongCredit, raw, reader));
            expect(dto).toMatchObject({ typeId: type.publicId, userId: person.publicId });
            expect(dto).not.toHaveProperty("type");
            expect(view.hydrate(dto, references)).toMatchObject({ type: { name: "Auteur", color: { id: "green" } } });
        }
        for (const view of [songDetailView, songSearchView]) {
            const raw = await tx.song.findUniqueOrThrow({ ...view.getSelectionArgs({ filter: {}, auth: reader }), where: { id: song.id } });
            const dto = view.parseDto(projectDB3ModelPublicIds(view.entity, raw, reader));
            expect(view.hydrate(dto, references).credits).toMatchObject([{ type: { publicId: type.publicId, name: "Auteur" } }]);
        }
        await expect(queryView({ view: songCreditEditorView, filter: {}, cmdbQueryContext: "deferred credits" }, reader, await snapshot(tx, reader))).rejects.toThrow();
        await expect(createCommandRowServices(reader, tx).update(xSongCredit, parsePublicId<"SongCredit">(credit.publicId), { comment: "Changed" })).rejects.toThrow();
        expect(await tx.songCredit.findUniqueOrThrow({ where: { id: credit.id } })).toMatchObject({ comment: "Credit" });
    }));

    it("rejects band authority, selected-band writes and revoked platform grants", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const member = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        const manager = await catalogManager(tx, fixture);
        const created = await executeCatalogCrud(tx, manager.auth, songCreditTypeEditorView, { name: text("Composer"), description: text("") });
        const selected = await loadAuthorizationForUser(manager.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        for (const writer of [member, selected]) {
            await expect(executeCatalogCrud(tx, writer, songCreditTypeEditorView, { sortOrder: 99 }, created.identity)).rejects.toThrow();
        }
        await tx.globalRolePermission.deleteMany({ where: { globalRoleId: manager.role.id } });
        await expect(executeCatalogCrud(tx, manager.auth, songCreditTypeEditorView, { sortOrder: 99 }, created.identity)).rejects.toThrow();
        expect(await tx.songCreditType.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ sortOrder: 0 });
    }));

    it("rejects mismatched strings, inheritance and disabled locales without partial writes", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { auth } = await catalogManager(tx, fixture);
        const created = await executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("Composer"), description: text("") });
        const row = await readType(tx, auth, "en-US");
        const count = await tx.dynamicLocalizedStringValue.count();
        await expect(executeCatalogCrud(tx, auth, songCreditTypeEditorView, { sortOrder: 99, name: text("Wrong", "en-US", row.descriptionStringPublicId) }, created.identity)).rejects.toThrow("does not belong");
        await expect(executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: { kind: "inherit", stringPublicId: row.nameStringPublicId } }, created.identity)).rejects.toThrow();
        await tx.locale.update({ where: { id: fixture.frenchId }, data: { isDeleted: true } });
        await expect(executeCatalogCrud(tx, auth, songCreditTypeEditorView, { name: text("Auteur", "fr-BE", row.nameStringPublicId) }, created.identity)).rejects.toThrow("enabled global locale");
        expect(await tx.dynamicLocalizedStringValue.count()).toBe(count);
        expect(await tx.songCreditType.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ sortOrder: 0 });
    }));
});
