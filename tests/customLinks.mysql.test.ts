import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { GetAuthorizedCustomLinkFile, GetAuthorizedDirectDownloadFile } from "src/core/db3/server/fileDownload";
import { customLinkEditorView, customLinkFileSelectionView, customLinkListView } from "src/core/db3/shared/entities/customLink/customLinkViews";
import { xCustomLinkFile } from "src/core/db3/shared/entities/customLink/customLinkFile";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { executeCatalogCrud } from "./support/db3CatalogFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const redirect = { name: "Programme", description: "**Public**", slug: "programme", redirectType: "Temporary", destinationURL: "https://target.test/programme", forwardQuery: true };

describe.skipIf(!settingsMysqlTestUrl)("band custom links on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    async function authorize(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
        const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.view_custom_links, Permission.manage_custom_links, Permission.view_files] } } });
        await tx.bandRolePermission.createMany({ data: permissions.map(permission => ({
            publicId: generatePublicId(), bandRoleId: member.bandRoleId!, permissionId: permission.id,
        })), skipDuplicates: true });
        return loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
    }

    async function files(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
        const publicPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.public } });
        const base = { fileLeafName: "page.html", description: "Local page", uploadedAt: new Date(), visiblePermissionId: publicPermission.id };
        const create = (values: Partial<Prisma.FileUncheckedCreateInput>) => tx.file.create({ data: {
            ...base, publicId: generatePublicId(), storedLeafName: `${generatePublicId()}.html`, bandId: fixture.bands[0]!.id, ...values,
        } });
        return {
            local: await create({}), foreign: await create({ bandId: fixture.bands[1]!.id }),
            deleted: await create({ isDeleted: true }), external: await create({ externalURI: "https://external.test" }),
            private: await create({ visiblePermissionId: null, uploadedByUserId: fixture.admin.id }),
            owned: await create({ visiblePermissionId: null, uploadedByUserId: fixture.user.id }),
        };
    }

    const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });

    it("creates, reads, updates and deletes redirects with server-owned band and creator IDs", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const result = await executeCatalogCrud(tx, auth, customLinkEditorView, redirect);
        const row = await tx.customLink.findUniqueOrThrow({ where: { publicId: String(result.identity) } });
        expect(row).toMatchObject({ ...redirect, bandId: fixture.bands[0]!.id, createdByUserId: fixture.user.id });
        await tx.customLinkVisit.create({ data: { customLinkId: row.id } });
        const list = await queryView({ view: customLinkListView, filter: {}, cmdbQueryContext: "redirect CRUD" }, auth, await snapshot(tx, auth));
        expect(list.items).toHaveLength(1);
        expect(list.items[0]).toMatchObject({ publicId: result.identity, fileId: null, file: null, _count: { visits: 1 } });
        expect(list.items[0]).not.toHaveProperty("bandId");
        expect(list.items[0]).not.toHaveProperty("id");
        await executeCatalogCrud(tx, auth, customLinkEditorView, { redirectType: "IntermediatePage", intermediateMessage: "**Read first**" }, result.identity);
        expect(await tx.customLink.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ redirectType: "IntermediatePage", intermediateMessage: "**Read first**" });
        const command = customLinkEditorView.crud.operations.delete!.command;
        await getDB3CommandHandler(command.commandID).execute(command.parseDto({ identity: result.identity }), {
            authorization: auth, transaction: tx, rowServices: createCommandRowServices(auth, tx),
        });
        expect(await tx.customLink.count()).toBe(0);
        expect(await tx.customLinkVisit.count()).toBe(0);
    }));

    it("isolates identical slugs, reads and mutation identities across bands", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const own = await executeCatalogCrud(tx, auth, customLinkEditorView, redirect);
        const other = await tx.customLink.create({ data: { ...redirect, publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
        expect(await tx.customLink.findUniqueOrThrow({ where: { bandId_slug: { bandId: fixture.bands[0]!.id, slug: redirect.slug } } })).toMatchObject({ publicId: own.identity });
        const list = await queryView({ view: customLinkListView, filter: {}, cmdbQueryContext: "band isolation" }, auth, await snapshot(tx, auth));
        expect(list.items.map(item => item.publicId)).toEqual([own.identity]);
        await expect(executeCatalogCrud(tx, auth, customLinkEditorView, { name: "Foreign write" }, parsePublicId<"CustomLink">(other.publicId))).rejects.toThrow();
        await expect(createCommandRowServices(auth, tx).delete(customLinkListView.entity, parsePublicId<"CustomLink">(other.publicId), "hard")).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, customLinkEditorView, redirect)).rejects.toThrow();
        expect(await tx.customLink.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({ name: redirect.name });
    }));

    it("rejects missing context, caller-owned IDs and revoked edit authority", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(executeCatalogCrud(tx, platform, customLinkEditorView, redirect)).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, customLinkEditorView, { ...redirect, bandId: fixture.bands[1]!.id })).rejects.toThrow();
        await expect(executeCatalogCrud(tx, auth, customLinkEditorView, { ...redirect, redirectType: null })).rejects.toThrow();
        const result = await executeCatalogCrud(tx, auth, customLinkEditorView, redirect);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_custom_links } });
        await tx.bandRolePermission.deleteMany({ where: { permissionId: permission.id } });
        await expect(executeCatalogCrud(tx, auth, customLinkEditorView, { name: "Revoked" }, result.identity)).rejects.toThrow();
    }));

    it("selects and serves only visible local files in the same band", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const targets = await files(tx, fixture);
        const selected = await queryView({ view: customLinkFileSelectionView, filter: {}, cmdbQueryContext: "file selection" }, auth, await snapshot(tx, auth));
        expect(selected.items.map(file => file.publicId).sort()).toEqual([targets.local.publicId, targets.owned.publicId].sort());
        for (const target of [targets.local, targets.owned]) {
            expect(await GetAuthorizedCustomLinkFile(target.publicId, auth, await snapshot(tx, auth))).toMatchObject({ storedLeafName: target.storedLeafName });
            expect(await GetAuthorizedDirectDownloadFile(target.storedLeafName, auth, await snapshot(tx, auth))).toMatchObject({ publicId: target.publicId });
        }
        for (const target of [targets.foreign, targets.deleted, targets.private, targets.external]) {
            expect(await GetAuthorizedCustomLinkFile(target.publicId, auth, await snapshot(tx, auth))).toBeNull();
            expect(await GetAuthorizedDirectDownloadFile(target.storedLeafName, auth, await snapshot(tx, auth))).toBeNull();
        }
        const unscoped = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(GetAuthorizedDirectDownloadFile(targets.local.storedLeafName, unscoped, await snapshot(tx, unscoped))).rejects.toThrow();
        await tx.file.update({ where: { id: targets.local.id }, data: { visiblePermissionId: null } });
        expect(await GetAuthorizedDirectDownloadFile(targets.local.storedLeafName, auth, await snapshot(tx, auth))).toBeNull();
        await tx.bandUser.updateMany({ where: { bandId: fixture.bands[0]!.id, userId: fixture.user.id }, data: { isDeleted: true } });
        expect(await GetAuthorizedDirectDownloadFile(targets.owned.storedLeafName, auth, await snapshot(tx, auth))).toBeNull();
        expect(xCustomLinkFile.authorizeRowBeforeInsert({ auth })).toBe(false);
        expect(xCustomLinkFile.deletePolicy).toBe("disabled");
    }));

    it("creates file links by public identity and rejects crafted unavailable targets", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const targets = await files(tx, fixture);
        const fileLink = { ...redirect, redirectType: "ServeFile", destinationURL: null, forwardQuery: false };
        const created = await executeCatalogCrud(tx, auth, customLinkEditorView, { ...fileLink, fileId: targets.local.publicId });
        expect(await tx.customLink.findUniqueOrThrow({ where: { publicId: String(created.identity) } })).toMatchObject({ fileId: targets.local.id, bandId: fixture.bands[0]!.id });
        for (const target of [targets.foreign, targets.deleted, targets.private, targets.external]) {
            await expect(executeCatalogCrud(tx, auth, customLinkEditorView, { ...fileLink, slug: target.publicId, fileId: target.publicId })).rejects.toThrow();
            await expect(executeCatalogCrud(tx, auth, customLinkEditorView, { fileId: target.publicId }, created.identity)).rejects.toThrow();
        }
        const list = await queryView({ view: customLinkListView, filter: {}, cmdbQueryContext: "file link read" }, auth, await snapshot(tx, auth));
        expect(list.items[0]?.file).toMatchObject({ publicId: targets.local.publicId, fileLeafName: targets.local.fileLeafName });
    }));

    it("refreshes file visibility and rejects deleted band context", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await authorize(tx, fixture);
        const targets = await files(tx, fixture);
        await tx.file.update({ where: { id: targets.local.id }, data: { visiblePermissionId: null } });
        expect(await GetAuthorizedCustomLinkFile(targets.local.publicId, auth, await snapshot(tx, auth))).toBeNull();
        await tx.band.update({ where: { id: fixture.bands[0]!.id }, data: { isDeleted: true } });
        await expect(snapshot(tx, auth)).rejects.toThrow();
    }));
});
