import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { createDashboardReferenceStore, menuLinkEditorView, menuLinkListView, reorderMenuLinksCommand, xMenuLink } from "src/core/db3/db3";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView, DB3PaginatedQueryCore } from "src/core/db3/server/db3QueryCore";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const text = (value: string, localeTag = "en-US") => ({ kind: "set", stringPublicId: null, localeTag, value });
const linkValues = (caption = "Scores") => ({
    caption: text(caption), applicationPage: "Resources", groupName: "scores", groupCssClass: "", itemCssClass: "",
    linkType: "ExternalURL", externalURI: "https://example.test/scores", wikiSlug: null, iconName: "Link",
});
const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) =>
    bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
const identity = (value: string) => xMenuLink.parseIdentity(value);

describe.skipIf(!settingsMysqlTestUrl)("band menu links on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database, work);

    async function authorize(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.customize_menu } });
        await tx.bandRolePermission.createMany({ data: { publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id }, skipDuplicates: true });
        return loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
    }
    async function read(tx: Prisma.TransactionClient, auth: CMServerAuthorization, routeLocale = "en-US") {
        return queryView({ view: menuLinkListView, filter: {}, routeLocale, cmdbQueryContext: "menu fixture" }, auth, await snapshot(tx, auth));
    }
    async function rawLink(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, bandIndex: number, caption: string, creatorId = fixture.user.id, publicId: string = generatePublicId()) {
        return tx.menuLink.create({ data: {
            ...linkValues(), caption: { create: { publicId: generatePublicId(), values: { create: {
                publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: caption,
            } } } },
            publicId, band: { connect: { id: fixture.bands[bandIndex]!.id } },
            createdByUser: { connect: { id: creatorId } },
        } });
    }
    async function reorder(tx: Prisma.TransactionClient, auth: CMServerAuthorization, ids: string[]) {
        const fresh = await auth.refresh(tx);
        return getDB3CommandHandler(reorderMenuLinksCommand.commandID).execute(reorderMenuLinksCommand.parseDto({
            movingItemId: ids[0], newPositionItemId: ids[1], scopeRowIds: ids,
        }), { authorization: fresh, transaction: tx, rowServices: createCommandRowServices(fresh, tx) });
    }

    it("uses generated localized CRUD, server-owned ownership and public transport", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const created = await executeCatalogCrud(tx, auth, menuLinkEditorView, linkValues());
        const row = await tx.menuLink.findUniqueOrThrow({ where: { publicId: String(created.identity) } });
        expect(row).toMatchObject({ bandId: fixture.bands[0]!.id, createdByUserId: fixture.user.id });
        const dto = (await read(tx, auth)).items[0]!;
        expect(dto).toMatchObject({ publicId: created.identity, caption: "Scores" });
        expect(dto).not.toHaveProperty("bandId");
        expect(dto).not.toHaveProperty("captionId");
        expect(dto).not.toHaveProperty("id");
        const client = menuLinkListView.hydrate(dto, createDashboardReferenceStore());
        expect(client.caption).toMatchObject({ value: "Scores", canInherit: false });
        expect(xMenuLink.fields.caption.codec.encode(client.caption)).toBeUndefined();
        await executeCatalogCrud(tx, auth, menuLinkEditorView, { groupCssClass: "edited" }, created.identity);
        expect(await tx.bandDynamicLocalizedStringValue.count({ where: { stringId: row.captionId } })).toBe(1);
        expect(await tx.change.count({ where: { table: "MenuLink", userId: fixture.user.id } })).toBeGreaterThan(0);
        await createCommandRowServices(auth, tx).delete(xMenuLink, xMenuLink.identitySchema.parse(created.identity), "hard");
        expect(await tx.menuLink.count({ where: { id: row.id } })).toBe(0);
    }));

    it("edits explicit band languages without copying fallback or overwriting shared text", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const legacy = await rawLink(tx, fixture, 0, "Shared English");
        const dto = (await read(tx, auth, "fr-BE")).items[0]!;
        expect(dto.caption).toBe("Shared English");
        await executeCatalogCrud(tx, auth, menuLinkEditorView, { caption: {
            ...text("Partitions", "fr-BE"), stringPublicId: dto.captionStringPublicId,
        } }, identity(legacy.publicId));
        expect((await read(tx, auth, "fr-BE")).items[0]!.caption).toBe("Partitions");
        // Band scope wins before locale fallback, even when the shared English text is exact.
        expect((await read(tx, auth)).items[0]!.caption).toBe("Partitions");
        expect(await tx.dynamicLocalizedStringValue.findFirstOrThrow({ where: { stringId: legacy.captionId } }))
            .toMatchObject({ indexedValue: "Shared English" });
        await executeCatalogCrud(tx, auth, menuLinkEditorView, { caption: {
            ...text("", "fr-BE"), stringPublicId: dto.captionStringPublicId,
        } }, identity(legacy.publicId));
        expect((await read(tx, auth, "fr-BE")).items[0]!.caption).toBe("");
    }));

    it("isolates bands before creator visibility and retains private-row policy", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const own = await rawLink(tx, fixture, 0, "Own private link");
        const other = await rawLink(tx, fixture, 1, "Foreign link with same creator");
        await rawLink(tx, fixture, 0, "Another creator's private link", fixture.admin.id);
        expect((await read(tx, auth)).items.map(item => item.publicId)).toEqual([own.publicId]);
        await expect(executeCatalogCrud(tx, auth, menuLinkEditorView, { groupName: "forged" }, identity(other.publicId))).rejects.toThrow();
        await expect(createCommandRowServices(auth, tx).delete(xMenuLink, identity(other.publicId), "hard")).rejects.toThrow();
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(read(tx, platform)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, platform, menuLinkEditorView, linkValues())).rejects.toThrow();
    }));

    it("rejects ownership, string and locale forgery and refreshes revoked grants", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const created = await executeCatalogCrud(tx, auth, menuLinkEditorView, linkValues());
        for (const forged of [{ bandId: fixture.bands[1]!.id }, { captionId: 1 }, { createdByUserId: fixture.admin.id }]) {
            await expect(executeCatalogCrud(tx, auth, menuLinkEditorView, { ...linkValues(), ...forged })).rejects.toThrow();
        }
        const foreign = await rawLink(tx, fixture, 1, "Other band");
        const source = await tx.dynamicLocalizedString.findUniqueOrThrow({ where: { id: foreign.captionId } });
        await expect(executeCatalogCrud(tx, auth, menuLinkEditorView, { caption: {
            ...text("Wrong string"), stringPublicId: source.publicId,
        } }, created.identity)).rejects.toThrow();
        await tx.bandLocale.deleteMany({ where: { bandId: fixture.bands[0]!.id, localeId: fixture.dutchId } });
        await expect(executeCatalogCrud(tx, auth, menuLinkEditorView, {
            ...linkValues(), caption: text("Disabled language", "nl-BE"),
        })).rejects.toThrow();
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.customize_menu } });
        await tx.bandRolePermission.deleteMany({ where: { permissionId: permission.id } });
        await expect(executeCatalogCrud(tx, auth, menuLinkEditorView, { groupName: "Revoked" }, created.identity)).rejects.toThrow();
        await expect(reorder(tx, auth, [String(created.identity), foreign.publicId])).rejects.toThrow();
    }));

    it("reorders only visible selected-band rows through audited public identities", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const first = await rawLink(tx, fixture, 0, "First", fixture.user.id, "ZWikiMenu0000001"),
            second = await rawLink(tx, fixture, 0, "Second", fixture.user.id, "aWikiMenu0000002");
        // New links share position zero; list and command must use the same public-ID tie-breaker.
        const initial = [first.publicId, second.publicId].sort();
        expect((await read(tx, auth)).items.map(item => item.publicId)).toEqual(initial);
        await reorder(tx, auth, initial);
        const reordered = (await read(tx, auth)).items;
        expect(reordered.map(item => item.publicId)).toEqual([...initial].reverse());
        expect(reordered.map(item => item.sortOrder)).toEqual([0, 1]);
        const foreign = await rawLink(tx, fixture, 1, "Foreign");
        const before = await tx.menuLink.findMany({ orderBy: { id: "asc" } });
        await expect(reorder(tx, auth, [first.publicId, foreign.publicId])).rejects.toThrow();
        expect(await tx.menuLink.findMany({ orderBy: { id: "asc" } })).toEqual(before);
        expect(await tx.change.count({ where: { table: "MenuLink", userId: fixture.user.id, action: "update" } })).toBeGreaterThan(0);
    }));

    it("filters, orders, counts and pages by the resolved caption", () => withFixture(async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        for (const caption of ["Partitions B", "Partitions A", "Autre"]) {
            await executeCatalogCrud(tx, auth, menuLinkEditorView, { ...linkValues(), caption: text(caption, "fr-BE") });
        }
        const result = await DB3PaginatedQueryCore({ table: { tableID: xMenuLink.tableID, tableName: xMenuLink.tableName, viewID: menuLinkListView.viewID },
            routeLocale: "fr-BE", filter: { quickFilterValues: ["Partitions"] }, orderBy: { caption: "asc" },
            skip: 1, take: 1, cmdbQueryContext: "resolved menus",
        }, auth, await snapshot(tx, auth));
        expect(result.count).toBe(2);
        expect(result.items.map(item => item.caption)).toEqual(["Partitions B"]);
    }));
});
