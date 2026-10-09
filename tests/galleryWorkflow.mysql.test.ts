import { PrismaClient, type Prisma } from "@prisma/client";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { frontpageGalleryItemEditorView, fileImageChoiceView, xFile, xFrontpageGalleryItem, xPermission } from "src/core/db3/db3";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { updateGalleryItemImage } from "src/core/db3/server/galleryImage";
import { galleryReorderCommandHandler } from "src/core/db3/server/commands/galleryOperations";
import { MakeDefaultImageEditParams } from "src/core/db3/shared/fileTypes";
import { UpdateGalleryItemImageResultSchema, type GalleryImageInput } from "src/core/db3/shared/galleryImage";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { songTransactionRoot } from "./support/songWorkflowMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function withStorage(work: (directory: string) => Promise<void>) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "cmdb-gallery-workflow-"));
    try {
        await work(directory);
    } finally {
        if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("cmdb-gallery-workflow-")) {
            throw new Error("Unexpected private gallery fixture directory.");
        }
        await rm(directory, { recursive: true, force: true });
    }
}

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, directory: string) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.edit_public_homepage, Permission.upload_files,
        Permission.view_files, Permission.visibility_members, Permission.visibility_public]);
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const pixels = new Uint8Array(60 * 40 * 3);
    for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 60; x++) {
            pixels.set(x < 30 ? [200, 5, 7] : [5, 7, 200], (y * 60 + x) * 3);
        }
    }
    const bytes = await sharp(pixels, { raw: { width: 60, height: 40, channels: 3 } }).png().toBuffer();
    const storedLeafName = generatePublicId() + ".png";
    await writeFile(path.join(directory, storedLeafName), new Uint8Array(bytes));
    const source = await tx.file.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
        uploadedByUserId: fixture.admin.id, visiblePermissionId: visibility.id, uploadedAt: new Date(),
        fileLeafName: "gallery.png", storedLeafName, description: "", mimeType: "image/png", sizeBytes: bytes.length,
        customData: JSON.stringify({ imageMetadata: { width: 60, height: 40 } }) } });
    const gallery = await tx.frontpageGalleryItem.create({ data: { publicId: generatePublicId(), fileId: source.id,
        createdByUserId: fixture.user.id, caption: "English", caption_fr: "Francais", caption_nl: "Nederlands",
        sortOrder: 0, displayParams: JSON.stringify(MakeDefaultImageEditParams()), visiblePermissionId: visibility.id } });
    const input: GalleryImageInput = { bandPublicId: c.args.bandPublicId,
        galleryItemId: xFrontpageGalleryItem.parseIdentity(gallery.publicId), imageParams: {
            parentFileId: xFile.parseIdentity(source.publicId), outputType: "png", quality: 80,
            editParams: { cropBegin: { x: 10, y: 10 }, cropSize: { width: 40, height: 20 }, rotate: 90 },
            newDimensions: { width: 20, height: 10 },
        } };
    const root = songTransactionRoot(tx);
    const snapshot = () => bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
    const rows = createCommandRowServices(c.auth, tx);
    const read = async () => queryView({ view: frontpageGalleryItemEditorView, filter: {}, routeLocale: "fr-BE",
        cmdbQueryContext: "gallery editor" }, c.auth, await snapshot());
    const reorder = async (movingItemId: typeof input.galleryItemId, newPositionItemId: typeof input.galleryItemId,
        scopeRowIds: typeof input.galleryItemId[]) => root.$transaction(async transaction => {
            const auth = await c.auth.refresh(transaction);
            return galleryReorderCommandHandler.execute({ movingItemId, newPositionItemId, scopeRowIds }, {
                authorization: auth, transaction, rowServices: createCommandRowServices(auth, transaction),
            });
        }, { isolationLevel: "Serializable" });
    return { ...c, source, gallery, input, root, rows, visibility, bytes, read, snapshot, reorder,
        bake: (patch: Partial<GalleryImageInput> = {}, auth = c.auth, database = root) =>
            updateGalleryItemImage(database, auth, { ...input, ...patch }, directory) };
}

describe.skipIf(!settingsMysqlTestUrl)("gallery editor and atomic image bake on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(async () => {
        if (database) {
            await initializeAccessControl(database);
        }
    }, 30_000);
    afterAll(async () => {
        await database?.$disconnect();
    });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, directory: string) => Promise<void>) => {
        if (!database) {
            throw new Error("A disposable gallery database is required.");
        }
        return withSettingsMysqlFixture(database, (tx, fixture) => withStorage(directory => work(tx, fixture, directory)));
    };

    it("creates through shared row services with File-owned band, gallery creator and public references", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const result = await c.rows.insert(xFrontpageGalleryItem, { fileId: c.input.imageParams.parentFileId,
            caption: "New", caption_fr: "", caption_nl: "", sortOrder: 3,
            visiblePermissionId: xPermission.parseIdentity(c.visibility.publicId), displayParams: JSON.stringify(MakeDefaultImageEditParams()) });
        const created = await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { publicId: result.publicId } });
        expect(created).toMatchObject({ createdByUserId: fixture.user.id, fileId: c.source.id, caption: "New" });
        const visible = await c.read();
        expect(visible.items.map(item => item.publicId)).toContain(created.publicId);
        expect(JSON.stringify(visible.items)).not.toMatch(/"(?:id|bandId|userId)":/);
        expect(await tx.change.count({ where: { table: "FrontpageGalleryItem", recordId: created.id } })).toBe(1);
        expect(await tx.file.findUniqueOrThrow({ where: { id: c.source.id } })).toEqual(c.source);
    }));

    it("saves three authored captions, intentional blanks and display edits without copying an image", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const displayParams = { cropBegin: { x: 5, y: 5 }, cropSize: { width: 30, height: 20 }, rotate: 12 };
        await c.rows.update(xFrontpageGalleryItem, c.input.galleryItemId, {
            caption: "Changed", caption_fr: "", caption_nl: "Wijziging", displayParams: JSON.stringify(displayParams) });
        const gallery = await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } });
        expect(gallery).toMatchObject({ caption: "Changed", caption_fr: "", caption_nl: "Wijziging", fileId: c.source.id });
        expect(JSON.parse(gallery.displayParams)).toEqual(displayParams);
        expect(await tx.file.count()).toBe(1);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it.each(["foreign", "private", "deleted"] as const)("rejects %s source selection through generated CRUD", kind => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const file = await tx.file.create({ data: { ...c.source, id: undefined, publicId: generatePublicId(), storedLeafName: generatePublicId(),
            ...(kind === "foreign" ? { bandId: fixture.bands[1]!.id } : kind === "private" ? { visiblePermissionId: null } : { isDeleted: true }) } });
        await expect(c.rows.update(xFrontpageGalleryItem, c.input.galleryItemId, { fileId: xFile.parseIdentity(file.publicId) })).rejects.toThrow();
        await expect(c.rows.insert(xFrontpageGalleryItem, { fileId: xFile.parseIdentity(file.publicId), caption: "", displayParams: "{}" })).rejects.toThrow();
        expect(await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } })).toEqual(c.gallery);
    }));

    it("keeps gallery creator privacy separate from image uploader privacy", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        await tx.frontpageGalleryItem.update({ where: { id: c.gallery.id }, data: { visiblePermissionId: null } });
        expect((await c.read()).items.map(item => item.publicId)).toEqual([c.gallery.publicId]);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, c.input.bandPublicId);
        const other = await queryView({ view: frontpageGalleryItemEditorView, filter: {}, cmdbQueryContext: "private gallery" },
            platform, await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }));
        expect(other.items).toEqual([]);
        await tx.file.update({ where: { id: c.source.id }, data: { visiblePermissionId: null } });
        expect((await c.read()).items).toEqual([]);
        await expect(c.bake()).rejects.toThrow();
    }));

    it("offers only independently visible local images in the selected band", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        for (const patch of [{ mimeType: "application/pdf" }, { externalURI: "https://example.com/image.png" },
            { bandId: fixture.bands[1]!.id }, { visiblePermissionId: null }, { isDeleted: true }]) {
            await tx.file.create({ data: { ...c.source, id: undefined, publicId: generatePublicId(), storedLeafName: generatePublicId(), ...patch } });
        }
        const options = await queryView({ view: fileImageChoiceView, filter: {}, cmdbQueryContext: "gallery source choices" }, c.auth, await c.snapshot());
        expect(options.items.map(item => item.publicId)).toEqual([c.source.publicId]);
    }));

    it("bakes crop/resize/rotation with matching pixels and one File/gallery/audit commit", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const result = await c.bake();
        expect(UpdateGalleryItemImageResultSchema.parse(result)).toEqual(result);
        expect(JSON.stringify(result)).not.toMatch(/"(?:id|bandId|storedLeafName|uploadedByUserId)":/);
        expect(result.newDisplayParams).toEqual(MakeDefaultImageEditParams());
        const file = await tx.file.findUniqueOrThrow({ where: { publicId: result.newFile.publicId } });
        expect(file).toMatchObject({ parentFileId: c.source.id, bandId: c.band.id, uploadedByUserId: fixture.user.id, visiblePermissionId: c.visibility.id });
        const image = await sharp(await readFile(path.join(directory, file.storedLeafName))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        expect(image.info).toMatchObject({ width: 10, height: 20 });
        expect([...image.data.subarray(0, 3)]).toEqual([200, 5, 7]);
        expect([...image.data.subarray(image.data.length - 3)]).toEqual([5, 7, 200]);
        expect(await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } })).toMatchObject({
            fileId: file.id, displayParams: JSON.stringify(MakeDefaultImageEditParams()), caption_fr: c.gallery.caption_fr });
        expect(await tx.change.count({ where: { table: "File", recordId: file.id } })).toBe(1);
        expect(await tx.change.count({ where: { table: "FrontpageGalleryItem", recordId: c.gallery.id } })).toBe(1);
        expect(await readFile(path.join(directory, c.source.storedLeafName))).toEqual(c.bytes);
    }));

    it("rebakes the current File instead of silently returning to its original parent", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const first = await tx.file.findUniqueOrThrow({ where: { publicId: (await c.bake()).newFile.publicId } });
        const second = await c.bake({ imageParams: { ...c.input.imageParams, parentFileId: xFile.parseIdentity(first.publicId),
            editParams: MakeDefaultImageEditParams(), newDimensions: undefined } });
        const file = await tx.file.findUniqueOrThrow({ where: { publicId: second.newFile.publicId } });
        expect(file.parentFileId).toBe(first.id);
        expect(JSON.parse(file.customData!).imageMetadata).toEqual({ width: 10, height: 20 });
    }));

    it.each(["deleted", "private", "foreign", "missing"] as const)("rejects %s gallery targets before writing an image", kind => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        if (kind === "foreign") {
            await tx.file.update({ where: { id: c.source.id }, data: { bandId: fixture.bands[1]!.id } });
        } else {
            await tx.frontpageGalleryItem.update({ where: { id: c.gallery.id }, data: kind === "deleted" ? { isDeleted: true }
                : kind === "private" ? { visiblePermissionId: null, createdByUserId: fixture.admin.id } : { publicId: generatePublicId() } });
        }
        const cutoff = await tx.change.count();
        await expect(c.bake()).rejects.toThrow();
        expect(await tx.file.count()).toBe(1); expect(await tx.change.count()).toBe(cutoff);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it.each([Permission.edit_public_homepage, Permission.upload_files, Permission.visibility_members])("rejects freshly revoked %s before output", permission => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: permission } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: grant.id } });
        await expect(c.bake()).rejects.toThrow();
        expect(await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } })).toEqual(c.gallery);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it("keeps an independently granted second band usable after first-band revocation", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const band = fixture.bands[1]!;
        const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.upload_files, Permission.edit_public_homepage, Permission.visibility_members] } } });
        const role = await tx.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            bandRolePermissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
        const file = await tx.file.create({ data: { ...c.source, id: undefined, publicId: generatePublicId(),
            storedLeafName: generatePublicId() + ".png", bandId: band.id } });
        await writeFile(path.join(directory, file.storedLeafName), new Uint8Array(c.bytes));
        const gallery = await tx.frontpageGalleryItem.create({ data: { ...c.gallery, id: undefined, publicId: generatePublicId(), fileId: file.id } });
        const permission = permissions.find(item => item.name === Permission.edit_public_homepage)!;
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        await expect(c.bake()).rejects.toThrow("edit_public_homepage");
        const bandPublicId = parsePublicId<"Band">(band.publicId);
        const result = await c.bake({ bandPublicId, galleryItemId: xFrontpageGalleryItem.parseIdentity(gallery.publicId),
            imageParams: { ...c.input.imageParams, parentFileId: xFile.parseIdentity(file.publicId) } },
            await loadAuthorizationForUser(fixture.user, tx, bandPublicId));
        expect((await tx.file.findUniqueOrThrow({ where: { publicId: result.newFile.publicId } })).bandId).toBe(band.id);
    }));

    it("refreshes roleless/inactive/deleted/merged users and selected-band state", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        for (const data of [{ bandRoleId: null }, { isDeleted: true }]) {
            await tx.bandUser.update({ where: { id: c.member.id }, data });
            await expect(c.bake()).rejects.toThrow();
            await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: c.role.id, isDeleted: false } });
        }
        for (const data of [{ isDeleted: true }, { mergedIntoUserId: fixture.admin.id }]) {
            await tx.user.update({ where: { id: fixture.user.id }, data });
            await expect(c.bake()).rejects.toThrow();
            await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: false, mergedIntoUserId: null } });
        }
        await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        await expect(c.bake()).rejects.toThrow();
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it("requires selected-band authority for anonymous, outsider and platform callers", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const outsider = await tx.user.create({ data: { publicId: generatePublicId(), name: "Outside", email: "gallery-outside@test.invalid" } });
        for (const actor of [null, outsider]) {
            await expect(c.bake({}, await loadAuthorizationForUser(actor, tx, c.input.bandPublicId))).rejects.toThrow();
        }
        await expect(c.bake({}, await loadAuthorizationForUser(fixture.admin, tx))).rejects.toThrow();
        await expect(c.bake({ bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow("selected band");
        expect((await c.bake({}, await loadAuthorizationForUser(fixture.admin, tx, c.input.bandPublicId))).newFile.publicId).toBeTruthy();
    }));

    it("reorders declared public scopes, audits changed rows and preserves unrelated slots", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const next = await tx.frontpageGalleryItem.create({ data: { ...c.gallery, id: undefined, publicId: generatePublicId(), sortOrder: 1 } });
        const untouched = await tx.frontpageGalleryItem.create({ data: { ...c.gallery, id: undefined, publicId: generatePublicId(), sortOrder: 9 } });
        const nextId = xFrontpageGalleryItem.parseIdentity(next.publicId);
        await c.reorder(c.input.galleryItemId, nextId, [c.input.galleryItemId, nextId]);
        expect((await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } })).sortOrder).toBe(1);
        expect((await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: next.id } })).sortOrder).toBe(0);
        expect((await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: untouched.id } })).sortOrder).toBe(9);
        expect(await tx.change.count({ where: { table: "FrontpageGalleryItem" } })).toBe(2);
    }));

    it.each(["deleted", "foreign", "private"] as const)("denies %s reorder scope without writes", kind => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const file = kind === "foreign" ? await tx.file.create({ data: { ...c.source, id: undefined, publicId: generatePublicId(),
            storedLeafName: generatePublicId(), bandId: fixture.bands[1]!.id } }) : c.source;
        const next = await tx.frontpageGalleryItem.create({ data: { ...c.gallery, id: undefined, publicId: generatePublicId(),
            fileId: file.id, sortOrder: 1, ...(kind === "deleted" ? { isDeleted: true } : kind === "private"
                ? { visiblePermissionId: null, createdByUserId: fixture.admin.id } : {}) } });
        const nextId = xFrontpageGalleryItem.parseIdentity(next.publicId);
        await expect(c.reorder(c.input.galleryItemId, nextId, [c.input.galleryItemId, nextId])).rejects.toThrow();
        expect((await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } })).sortOrder).toBe(0);
        expect(await tx.change.count({ where: { table: "FrontpageGalleryItem" } })).toBe(0);
    }));

    it("soft deletes a gallery item without deleting its independently owned image", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        await c.rows.delete(xFrontpageGalleryItem, c.input.galleryItemId, "softWhenPossible");
        expect((await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } })).isDeleted).toBe(true);
        expect((await tx.file.findUniqueOrThrow({ where: { id: c.source.id } })).isDeleted).toBe(false);
        expect((await c.read()).items).toEqual([]);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it.each(["gallery", "audit", "commit"] as const)("rolls back the new File, gallery, audits and storage after failed %s", kind => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const cutoff = await tx.change.count();
        // DB3 selects the capitalized Prisma delegate, which has its own proxy identity.
        const galleryDelegate: Prisma.TransactionClient["frontpageGalleryItem"] = Reflect.get(tx, xFrontpageGalleryItem.tableName);
        const originalAudit = tx.change.create.bind(tx.change);
        const failure = kind === "gallery" ? vi.spyOn(galleryDelegate, "update").mockRejectedValueOnce(new Error("Failed gallery write"))
            : kind === "audit" ? vi.spyOn(tx.change, "create").mockImplementationOnce(args => originalAudit(args))
                .mockRejectedValueOnce(new Error("Failed gallery write")) : null;
        const failedCommit: DB3ReadRootDatabase = { $transaction: work => c.root.$transaction(async transaction => {
            await work(transaction);
            throw new Error("Failed gallery write");
        }, { isolationLevel: "Serializable" }) };
        try {
            await expect(c.bake({}, c.auth, kind === "commit" ? failedCommit : c.root)).rejects.toThrow("Failed gallery write");
        } finally {
            failure?.mockRestore();
        }
        expect(await tx.frontpageGalleryItem.findUniqueOrThrow({ where: { id: c.gallery.id } })).toEqual(c.gallery);
        expect(await tx.file.count()).toBe(1); expect(await tx.change.count()).toBe(cutoff);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
        expect(await readFile(path.join(directory, c.source.storedLeafName))).toEqual(c.bytes);
    }));
});
