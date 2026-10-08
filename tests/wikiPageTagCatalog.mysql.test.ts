// Register association descriptors before compiling wiki views.
import "src/core/db3/db3";
import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { bandWikiPageTagView, xBandWikiPageTag } from "src/core/db3/shared/entities/wikiPageTag/wikiPageTagViews";
import { wikiPageEditorView, wikiPageSearchView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { xWikiPage } from "src/core/db3/shared/schema/wiki";
import { WikiPageTagAssignmentArgs, WikiPageTagAssignmentNaturalOrderBy } from "src/core/db3/shared/schema/prismArgs";
import { loadDashboardCatalogs } from "src/core/db3/server/db3DashboardCatalogs";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { projectDB3ModelPublicIds } from "src/core/db3/server/db3PublicIds";
import { DB3PaginatedQueryCore, queryView } from "src/core/db3/server/db3QueryCore";
import { createDashboardReferenceStore, registerDashboardReferences, wikiPageTagDashboardView } from "src/core/db3/shared/references/dashboardReferences";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const text = (value: string, localeTag = "en-US", stringPublicId: string | null = null) => ({ kind: "set", value, localeTag, stringPublicId });
const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
const authorize = (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index = 0) =>
    loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[index]!.publicId));

async function sharedTag(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const value = (indexedValue: string) => ({ create: { publicId: generatePublicId(), values: { create: {
        publicId: generatePublicId(), localeId: fixture.englishId, indexedValue,
    } } } });
    return tx.globalWikiPageTag.create({ data: {
        publicId: generatePublicId(), name: value("Policy"),
        description: { create: { publicId: generatePublicId(), format: "Markdown", values: { create: {
            publicId: generatePublicId(), localeId: fixture.englishId, blobValue: "**Shared details**",
        } } } }, color: "blue", sortOrder: 7,
    } });
}

async function readTags(tx: Prisma.TransactionClient, auth: CMServerAuthorization, routeLocale = "en-US") {
    return queryView({ view: bandWikiPageTagView, routeLocale, filter: {}, cmdbQueryContext: "wiki tag editor" }, auth, await snapshot(tx, auth));
}

describe.skipIf(!settingsMysqlTestUrl)("band wiki tag catalogs on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_wiki_pages } });
            await tx.bandRolePermission.createMany({ data: { publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id }, skipDuplicates: true });
            await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: member.bandRoleId } });
            await work(tx, fixture);
        });

    it("uses generated CRUD, explicit writing locales, shared opt-in, inherited codecs and audits", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const source = await sharedTag(tx, fixture);
        const rows = createCommandRowServices(auth, tx);
        const opted = await rows.optIn(xBandWikiPageTag, source.publicId);
        const auditCount = await tx.change.count({ where: { userId: auth.userId } });
        expect((await rows.optIn(xBandWikiPageTag, source.publicId)).publicId).toBe(opted.publicId);
        expect(await tx.change.count({ where: { userId: auth.userId } })).toBe(auditCount);
        const row = (await readTags(tx, auth)).items[0]!;
        const editor = bandWikiPageTagView.hydrate(row, createDashboardReferenceStore());
        expect(editor).toMatchObject({ name: { value: "Policy" }, color: { value: { id: "blue" }, override: null }, sortOrder: { value: 7, override: null } });
        expect(xBandWikiPageTag.fields.name.codec.encode(editor.name)).toBeUndefined();
        await executeCatalogCrud(tx, auth, bandWikiPageTagView, {
            color: xBandWikiPageTag.fields.color.codec.encode(editor.color), sortOrder: xBandWikiPageTag.fields.sortOrder.codec.encode(editor.sortOrder),
        }, row.publicId);
        expect(await tx.bandWikiPageTag.findUniqueOrThrow({ where: { publicId: row.publicId } })).toMatchObject({ nameId: null, color: null, sortOrder: null });
        await tx.globalWikiPageTag.update({ where: { id: source.id }, data: { color: "red", sortOrder: 13 } });
        expect((await readTags(tx, auth)).items[0]).toMatchObject({ color: "red", sortOrder: 13 });
        expect(() => xBandWikiPageTag.createInsertModelFromString!("Custom")).toThrow("writing locale");
        const created = await executeCatalogCrud(tx, auth, bandWikiPageTagView,
            xBandWikiPageTag.createInsertModelFromString!("Custom", { localeTag: "fr-BE" }));
        const custom = await tx.bandWikiPageTag.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
        expect(custom).toMatchObject({ bandId: fixture.bands[0]!.id, globalWikiPageTagId: null });
        expect(await tx.bandDynamicLocalizedStringValue.findFirstOrThrow({ where: { stringId: custom.nameId! } })).toMatchObject({ bandId: fixture.bands[0]!.id, localeId: fixture.frenchId, indexedValue: "Custom" });
        expect(await tx.change.count({ where: { table: "BandDynamicLocalizedStringValue", userId: auth.userId } })).toBe(1);
    }));

    it("resolves per-string fallback, intentional blanks and inheritance without crossing bands", () => withFixture(async (tx, fixture) => {
        const source = await sharedTag(tx, fixture);
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const opted = await createCommandRowServices(auth, tx).optIn(xBandWikiPageTag, source.publicId);
        const otherOpted = await createCommandRowServices(other, tx).optIn(xBandWikiPageTag, source.publicId);
        await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: text("Règlement", "fr-BE"), color: "green", sortOrder: 0 }, opted.publicId);
        const translated = (await readTags(tx, auth, "fr-BE")).items[0]!;
        expect(translated).toMatchObject({ name: "Règlement", description: "**Shared details**", descriptionResolution: { scope: "global", localeTag: "en-US" }, color: "green", sortOrder: 0 });
        const first = await loadDashboardCatalogs(await snapshot(tx, auth), auth, { routeLocale: "fr-BE" });
        const second = await loadDashboardCatalogs(await snapshot(tx, other), other, { routeLocale: "fr-BE" });
        expect(first.wikiPageTag).toMatchObject([{ publicId: opted.publicId, name: "Règlement" }]);
        expect(second.wikiPageTag).toMatchObject([{ publicId: otherOpted.publicId, name: "Policy" }]);
        const display = wikiPageTagDashboardView.hydrate(first.wikiPageTag[0]!, createDashboardReferenceStore());
        expect(display).toMatchObject({ name: "Règlement", color: { id: "green" }, sortOrder: 0 });
        expect(display).not.toHaveProperty("bandId");
        expect(display).not.toHaveProperty("nameId");
        await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: text("", "fr-BE", translated.nameStringPublicId) }, opted.publicId);
        expect((await readTags(tx, auth, "fr-BE")).items[0]).toMatchObject({ name: "", nameResolution: { reason: "exact" } });
        await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: { kind: "inherit", stringPublicId: translated.nameStringPublicId }, color: null, sortOrder: null }, opted.publicId);
        expect((await readTags(tx, auth, "fr-BE")).items[0]).toMatchObject({ name: "Policy", color: "blue", sortOrder: 7 });
        expect(await tx.dynamicLocalizedStringValue.count({ where: { stringId: source.nameId } })).toBe(1);
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        expect((await loadDashboardCatalogs(await snapshot(tx, platform), platform, {})).wikiPageTag).toEqual([]);
    }));

    it("filters, sorts and pages resolved names and enforces hidden-option authority", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const first = await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: text("Zulu local", "fr-BE"), sortOrder: 0 });
        const second = await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: text("Alpha local", "fr-BE"), sortOrder: 0 });
        const table = { tableID: xBandWikiPageTag.tableID, tableName: xBandWikiPageTag.tableName, viewID: bandWikiPageTagView.viewID };
        const page = await DB3PaginatedQueryCore({ table, routeLocale: "fr-BE", filter: { quickFilterValues: ["LOCAL"] }, orderBy: { name: "asc" }, skip: 0, take: 1, cmdbQueryContext: "localized wiki tags" }, auth, await snapshot(tx, auth));
        expect(page).toMatchObject({ count: 2, hasMore: true, items: [{ publicId: second.identity, name: "Alpha local" }] });
        await executeCatalogCrud(tx, auth, bandWikiPageTagView, { isHidden: true }, first.identity);
        expect((await readTags(tx, auth)).items).toHaveLength(1);
        expect((await loadDashboardCatalogs(await snapshot(tx, auth), auth, {})).wikiPageTag).toHaveLength(2);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { bandRoleId: null } });
        const member = await authorize(tx, fixture);
        expect((await loadDashboardCatalogs(await snapshot(tx, member), member, {})).wikiPageTag).toHaveLength(1);
        await expect(queryView({ view: bandWikiPageTagView, filter: { tableParams: { includeHidden: true } }, cmdbQueryContext: "hidden tags" }, member, await snapshot(tx, member))).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, bandWikiPageTagView, { isHidden: false }, first.identity)).rejects.toThrow();
    }));

    it("rejects foreign ownership, forged sources, wrong strings and disabled languages before mutation", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const created = await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: text("Custom"), description: text("Details"), sortOrder: 0 });
        const row = (await readTags(tx, auth)).items[0]!;
        expect((await readTags(tx, other)).items).toEqual([]);
        await expect(executeCatalogCrud(tx, other, bandWikiPageTagView, { sortOrder: 1 }, created.identity)).rejects.toThrow();
        for (const patch of [{ bandId: fixture.bands[1]!.id }, { globalWikiPageTagId: 1 }, { globalWikiPageTag: generatePublicId() }, { color: "invalid" }, { sortOrder: 1.5 }, { name: text("Wrong", "en-US", row.descriptionStringPublicId) }, { name: { kind: "inherit", stringPublicId: row.nameStringPublicId } }]) {
            await expect(executeCatalogCrud(tx, auth, bandWikiPageTagView, patch, created.identity)).rejects.toThrow();
        }
        await tx.bandLocale.delete({ where: { bandId_localeId: { bandId: fixture.bands[0]!.id, localeId: fixture.frenchId } } });
        await expect(executeCatalogCrud(tx, auth, bandWikiPageTagView, { sortOrder: 99, name: text("Langue", "fr-BE", row.nameStringPublicId) }, created.identity)).rejects.toThrow();
        expect(await tx.bandWikiPageTag.findUniqueOrThrow({ where: { publicId: row.publicId } })).toMatchObject({ bandId: fixture.bands[0]!.id, sortOrder: 0 });
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(readTags(tx, platform)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, platform, bandWikiPageTagView, { sortOrder: 1 }, created.identity)).rejects.toThrow();
    }));

    it("retains hidden assignments and cascades authorized catalog deletion without deleting pages", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture), other = await authorize(tx, fixture, 1);
        const source = await sharedTag(tx, fixture);
        const opted = await createCommandRowServices(auth, tx).optIn(xBandWikiPageTag, source.publicId);
        const tag = await tx.bandWikiPageTag.findUniqueOrThrow({ where: { publicId: opted.publicId } });
        const page = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, slug: "policy" } });
        await tx.wikiPageTagAssignment.create({ data: { publicId: generatePublicId(), wikiPageId: page.id, bandWikiPageTagId: tag.id } });
        await executeCatalogCrud(tx, auth, bandWikiPageTagView, { isHidden: true }, opted.publicId);
        expect(await tx.wikiPageTagAssignment.count({ where: { wikiPageId: page.id } })).toBe(1);
        await expect(createCommandRowServices(other, tx).delete(xBandWikiPageTag, opted.publicId, "hard")).rejects.toThrow();
        await createCommandRowServices(auth, tx).delete(xBandWikiPageTag, opted.publicId, "hard");
        expect(await tx.wikiPageTagAssignment.count({ where: { wikiPageId: page.id } })).toBe(0);
        expect(await tx.wikiPage.count({ where: { id: page.id } })).toBe(1);
        expect(await tx.globalWikiPageTag.count({ where: { id: source.id } })).toBe(1);
        expect(await tx.change.count({ where: { table: "bandWikiPageTag", action: "delete", userId: auth.userId } })).toBe(1);
    }));

    it("projects public band-tag identities and orders editor/search associations by resolved captions", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const page = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, createdByUserId: fixture.user.id, slug: "policy" } });
        const ids: string[] = [];
        for (const [english, french] of [["Alpha", "Zulu"], ["Zulu", "Alpha"]]) {
            const created = await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: text(english!), sortOrder: 0 });
            const tag = await tx.bandWikiPageTag.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
            await executeCatalogCrud(tx, auth, bandWikiPageTagView, { name: text(french!, "fr-BE", (await tx.dynamicLocalizedString.findUniqueOrThrow({ where: { id: tag.nameId! } })).publicId) }, created.identity);
            await tx.wikiPageTagAssignment.create({ data: { publicId: generatePublicId(), wikiPageId: page.id, bandWikiPageTagId: tag.id } });
            ids.push(tag.publicId);
        }
        const rawAssignments = await tx.wikiPageTagAssignment.findMany({ ...WikiPageTagAssignmentArgs, orderBy: WikiPageTagAssignmentNaturalOrderBy });
        expect(rawAssignments).toHaveLength(2);
        const catalogs = await loadDashboardCatalogs(await snapshot(tx, auth), auth, { routeLocale: "fr-BE" });
        const references = createDashboardReferenceStore();
        registerDashboardReferences(references, { wikiPageTag: catalogs.wikiPageTag.map(dto => wikiPageTagDashboardView.hydrate(dto, references)) });
        for (const view of [wikiPageEditorView, wikiPageSearchView]) {
            const raw = await tx.wikiPage.findUniqueOrThrow({ ...view.getSelectionArgs({ filter: {}, auth }), where: { id: page.id } });
            // The same public tag contract serves page editing and search results.
            const dto = view.parseDto(projectDB3ModelPublicIds(xWikiPage, raw, auth));
            expect(dto.tags).toHaveLength(2);
            expect(dto.tags?.[0]).not.toHaveProperty("tagId");
            expect(dto.tags?.[0]).not.toHaveProperty("wikiPageId");
            expect(view.hydrate(dto, references).tags.map(item => item.tag.name)).toEqual(["Alpha", "Zulu"]);
            expect(view.hydrate(dto, references).tags.map(item => item.bandWikiPageTagId)).toEqual([ids[1], ids[0]]);
        }
        const pages = await queryView({ view: wikiPageEditorView, filter: {}, cmdbQueryContext: "owned wiki page" }, auth, await snapshot(tx, auth));
        expect(pages.items[0]?.tags).toHaveLength(2);
        const foreignAuth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        expect((await queryView({ view: wikiPageEditorView, filter: {}, cmdbQueryContext: "other band's wiki pages" }, foreignAuth, await snapshot(tx, foreignAuth))).items).toEqual([]);
    }));
});
