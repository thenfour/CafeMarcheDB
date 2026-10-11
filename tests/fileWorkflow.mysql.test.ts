import { PrismaClient, type Prisma } from "@prisma/client";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { FileUploadInputError, uploadFiles, type FileUploadPart } from "src/core/db3/server/fileUpload";
import { createUploadedImagePreview } from "src/core/db3/server/uploadedImage";
import { FileUploadArgsSchema, FileUploadResponseSchema, type FileUploadArgs } from "src/core/db3/shared/fileUpload";
import { eventReferenceView, songReferenceView, fileDetailView, fileEditorView, xBandUser, xFile, xFileSongTag, xInstrument, xPermission, xSong, xWikiPage } from "src/core/db3/db3";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareSongs } from "./support/songWorkflowMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareSongs(tx, fixture);
    const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.upload_files, Permission.view_users_basic_info] } } });
    await tx.bandRolePermission.createMany({ data: permissions.map(permission => ({ publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: permission.id })) });
    const auth = await c.auth.refresh(tx);
    const args: FileUploadArgs = { bandPublicId: c.args.bandPublicId, visiblePermissionId: xPermission.parseIdentity(c.visibility.publicId),
        taggedSongId: c.target.songId, taggedEventId: c.args.eventId,
        taggedBandUserId: xBandUser.parseIdentity(c.member.publicId), taggedInstrumentId: xInstrument.parseIdentity(c.instrument.publicId) };
    const root = c.root;
    return { ...c, auth, uploadArgs: args, rows: createCommandRowServices(auth, tx),
        upload: (parts: readonly FileUploadPart[], storage: string, patch: Partial<FileUploadArgs> = {}, database = root) =>
            uploadFiles(database, auth, { ...args, ...patch }, parts, storage) };
}

async function withStorage(work: (storage: string, input: string) => Promise<void>): Promise<void> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "cmdb-file-workflow-"));
    const storage = path.join(directory, "stored");
    const input = path.join(directory, "incoming");
    await Promise.all([mkdir(storage), mkdir(input)]);
    try {
        await work(storage, input);
    } finally {
        // This exact private directory was created above; never clean the application's storage.
        if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("cmdb-file-workflow-")) {
            throw new Error("Unexpected private upload fixture directory.");
        }
        await rm(directory, { recursive: true, force: true });
    }
}

describe.skipIf(!settingsMysqlTestUrl)("associated File editing and uploads on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(async () => initializeAccessControl(database), 30_000);
    afterAll(async () => database.$disconnect());
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("associates Markdown uploads with the public Wiki identity and rechecks the parent visibility grant", () => run(async (tx, fixture) => withStorage(async storage => {
        const c = await prepare(tx, fixture);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_editors } });
        const grant = await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: permission.id } });
        const page = await tx.wikiPage.create({ data: { publicId: generatePublicId(), bandId: c.band.id, slug: "attachment-page",
            createdByUserId: fixture.admin.id, visiblePermissionId: permission.id } });
        const patch = { taggedWikiPageId: xWikiPage.parseIdentity(page.publicId), externalURI: "https://example.com/score.pdf" };
        const response = await c.upload([], storage, patch);
        const file = await tx.file.findUniqueOrThrow({ where: { publicId: response.files[0]!.publicId }, include: { taggedWikiPages: true } });
        expect(file.bandId).toBe(c.band.id); expect(file.taggedWikiPages.map(tag => tag.wikiPageId)).toEqual([page.id]);
        await tx.bandRolePermission.delete({ where: { id: grant.id } });
        const before = { files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileWikiPageTag.count() };
        await expect(c.upload([], storage, patch)).rejects.toThrow();
        expect({ files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileWikiPageTag.count() }).toEqual(before);
        expect(await readdir(storage)).toEqual([]);
    })));

    it("creates an external URL using public associations, actor ownership and shared audits", () => run(async (tx, fixture) => withStorage(async storage => {
        const c = await prepare(tx, fixture);
        const result = await c.upload([], storage, { externalURI: "https://example.com/score.pdf" });
        expect(FileUploadResponseSchema.parse(result).files).toHaveLength(1);
        expect(JSON.stringify(result)).not.toMatch(/"(?:id|bandId|userId)":/);
        const file = await tx.file.findUniqueOrThrow({ where: { publicId: result.files[0]!.publicId }, include: {
            taggedSongs: true, taggedEvents: true, taggedUsers: true, taggedInstruments: true,
        } });
        expect(file).toMatchObject({ bandId: c.band.id, uploadedByUserId: fixture.user.id, sizeBytes: null, externalURI: "https://example.com/score.pdf" });
        expect(file.uploadedAt).toBeInstanceOf(Date);
        expect(file.taggedUsers).toMatchObject([{ bandUserId: c.member.id }]);
        expect(file.taggedSongs).toMatchObject([{ songId: c.songs[0]!.id }]);
        expect(file.taggedEvents).toMatchObject([{ eventId: c.event.id }]);
        expect(file.taggedInstruments).toMatchObject([{ bandInstrumentId: c.instrument.id }]);
        expect(await tx.change.count({ where: { table: "File", recordId: file.id } })).toBe(1);
        expect(await readdir(storage)).toEqual([]);
        const snapshot = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        const visible = await queryView({ view: fileDetailView, filter: {}, cmdbQueryContext: "uploaded File" }, c.auth, snapshot);
        expect(visible.items.map(item => item.publicId)).toContain(file.publicId);
        const editor = await queryView({ view: fileEditorView, filter: {}, cmdbQueryContext: "File editor" }, c.auth, snapshot);
        expect(editor.items.map(item => item.publicId)).toContain(file.publicId);
        const songs = await queryView({ view: songReferenceView, filter: {}, cmdbQueryContext: "File song options" }, c.auth, snapshot);
        expect(songs.items).toContainEqual({ publicId: c.songs[0]!.publicId, name: c.songs[0]!.name });
        const events = await queryView({ view: eventReferenceView, filter: {}, cmdbQueryContext: "File event options" }, c.auth, snapshot);
        expect(events.items).toContainEqual({ publicId: c.event.publicId, name: c.event.name, startsAt: c.event.startsAt, typeId: null, statusId: null });
    })));

    it("edits own metadata and public associations, denies admin/storage fields and soft deletes", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const identity = xFile.parseIdentity(c.file.publicId);
        const command = fileEditorView.crud.operations.update.command;
        const dto = command.parseDto({ identity, patch: { description: "Notes", taggedUsers: [c.uploadArgs.taggedBandUserId],
            taggedInstruments: [c.uploadArgs.taggedInstrumentId], taggedEvents: [c.args.eventId], taggedSongs: [c.target.songId] } });
        await c.rows.update(xFile, dto.identity, dto.patch);
        expect(await tx.file.findUniqueOrThrow({ where: { id: c.file.id } })).toMatchObject({ description: "Notes", storedLeafName: c.file.storedLeafName });
        for (const member of ["storedLeafName", "mimeType", "sizeBytes", "customData", "uploadedAt", "uploadedByUserId", "bandId"]) {
            expect(() => command.parseDto({ identity, patch: { [member]: "forged" } })).toThrow();
        }
        await expect(c.rows.update(xFile, identity, { fileLeafName: "renamed.wav" })).rejects.toThrow();
        await expect(c.rows.insert(xFile, { description: "generic creation" })).rejects.toThrow("creation");
        await c.rows.delete(xFile, identity, "softWhenPossible");
        expect(await tx.file.findUniqueOrThrow({ where: { id: c.file.id } })).toMatchObject({ isDeleted: true });
        const context = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        expect((await queryView({ view: fileDetailView, filter: {}, cmdbQueryContext: "deleted File" }, c.auth, context)).items).toEqual([]);
    }));

    it("authorizes association insert, reparent, update and delete on the owning File", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const other = await tx.file.create({ data: { ...c.file, id: undefined, publicId: generatePublicId(), storedLeafName: generatePublicId(), uploadedByUserId: fixture.admin.id } });
        const newValues = { fileId: xFile.parseIdentity(other.publicId), songId: xSong.parseIdentity(c.songs[1]!.publicId) };
        await expect(c.rows.insert(xFileSongTag, newValues)).rejects.toThrow();
        const association = await c.rows.insert(xFileSongTag, { ...newValues, fileId: xFile.parseIdentity(c.file.publicId) });
        const identity = xFileSongTag.parseIdentity(association.publicId);
        await expect(c.rows.update(xFileSongTag, identity, { fileId: newValues.fileId })).rejects.toThrow();
        await c.rows.update(xFileSongTag, identity, { songId: xSong.parseIdentity(c.songs[2]!.publicId) });
        await c.rows.delete(xFileSongTag, identity, "hard");
        expect(await tx.fileSongTag.findUnique({ where: { publicId: identity } })).toBeNull();
        const managerPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_files } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: managerPermission.id } });
        const manager = createCommandRowServices(await c.auth.refresh(tx), tx);
        await manager.insert(xFileSongTag, newValues);
        await manager.update(xFile, xFile.parseIdentity(other.publicId), { description: "Managed" });
        expect((await tx.file.findUniqueOrThrow({ where: { id: other.id } })).description).toBe("Managed");
    }));

    it("uploads PDFs, audio and resized images with inherited automatic tags and instrument matching", () => run(async (tx, fixture) => withStorage(async (storage, input) => {
        const c = await prepare(tx, fixture);
        for (const significance of ["Partition", "Recording"]) {
            const text = await c.text(significance, significance);
            const global = await tx.globalFileTag.create({ data: { publicId: generatePublicId(), nameId: text.id, descriptionId: text.id, significance } });
            await tx.bandFileTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, globalFileTagId: global.id } });
        }
        await tx.bandInstrument.update({ where: { id: c.instrument.id }, data: { autoAssignFileLeafRegex: "trumpet" } });
        const names = ["trumpet.pdf", "concert.wav", "photo.png"];
        await writeFile(path.join(input, names[0]!), "score");
        await writeFile(path.join(input, names[1]!), "recording");
        await sharp({ create: { width: 40, height: 20, channels: 4, background: "red" } }).png().toFile(path.join(input, names[2]!));
        const parts = names.map(originalFilename => ({ originalFilename, temporaryPath: path.join(input, originalFilename), lastModifiedDate: null }));
        const result = await c.upload(parts, storage, { taggedInstrumentId: undefined, maxImageDimension: 10 });
        expect(result.files).toHaveLength(3);
        expect(await readdir(storage)).toHaveLength(4);
        const files = await tx.file.findMany({ where: { bandId: c.band.id }, include: { tags: { include: { bandFileTag: { include: { globalFileTag: true } } } }, taggedInstruments: true } });
        const pdf = files.find(file => file.fileLeafName === names[0])!;
        expect(pdf.tags.map(tag => tag.bandFileTag.globalFileTag?.significance)).toEqual(["Partition"]);
        expect(pdf.taggedInstruments).toMatchObject([{ bandInstrumentId: c.instrument.id }]);
        expect(files.find(file => file.fileLeafName === names[1])?.tags.map(tag => tag.bandFileTag.globalFileTag?.significance)).toEqual(["Recording"]);
        const image = files.find(file => file.fileLeafName === names[2])!;
        expect(JSON.parse(image.customData!)).toEqual({ imageMetadata: { width: 40, height: 20 } });
        expect(await readFile(path.join(storage, image.storedLeafName))).toEqual(await readFile(path.join(input, names[2]!)));
        const preview = files.find(file => file.publicId === result.files[2]?.publicId)!;
        expect(preview).toMatchObject({ parentFileId: image.id, fileLeafName: "photo_.jpg", mimeType: "image/jpeg", previewFileId: null });
        expect(JSON.parse(preview.customData!)).toEqual({ relationToParent: "forkedImage", imageMetadata: { width: 10, height: 5 } });
        expect((await readFile(path.join(storage, preview.storedLeafName))).length).toBe(preview.sizeBytes);
        expect(preview.taggedInstruments).toEqual([]);
        expect(await tx.change.count({ where: { table: "File", recordId: { in: files.map(file => file.id) } } })).toBe(4);
    })));

    it.each([
        { width: 10, height: 10, child: false },
        { width: 40, height: 10, child: false },
        { width: 10, height: 40, child: false },
        { width: 9, height: 15, child: false },
        { width: 20, height: 12, child: true },
    ])("retains the reference upload resize boundary for $width x $height", ({ width, height, child }) => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const originalFilename = "boundary.png";
        const temporaryPath = path.join(incoming, originalFilename);
        const bytes = await sharp({ create: { width, height, channels: 4, background: "red" } }).png().toBuffer();
        await writeFile(temporaryPath, new Uint8Array(bytes));
        const lastModifiedDate = new Date("2020-02-03T04:05:06.000Z");
        const response = await c.upload([{ originalFilename, temporaryPath, lastModifiedDate }], storage, { maxImageDimension: 10 });
        expect(FileUploadResponseSchema.parse(response)).toEqual(response);
        expect(response.files).toHaveLength(1);
        expect(JSON.stringify(response)).not.toMatch(/"(?:id|bandId|parentFileId|visiblePermissionId)":/);
        const original = await tx.file.findFirstOrThrow({ where: { fileLeafName: originalFilename, bandId: c.band.id }, include: { taggedSongs: true } });
        const returned = await tx.file.findUniqueOrThrow({ where: { publicId: response.files[0]!.publicId }, include: { taggedSongs: true } });
        expect(original.fileCreatedAt).toEqual(lastModifiedDate);
        expect(original.previewFileId).toBeNull();
        expect(await readFile(path.join(storage, original.storedLeafName))).toEqual(bytes);
        expect(original.taggedSongs.map(tag => tag.songId)).toEqual([c.songs[0]!.id]);
        expect(await readdir(storage)).toHaveLength(child ? 2 : 1);
        if (child) {
            expect(returned).toMatchObject({ parentFileId: original.id, fileLeafName: "boundary_.jpg", mimeType: "image/jpeg",
                bandId: original.bandId, uploadedByUserId: fixture.user.id, visiblePermissionId: original.visiblePermissionId });
            expect(returned.taggedSongs).toEqual([]);
            expect((await sharp(await readFile(path.join(storage, returned.storedLeafName))).metadata()).format).toBe("jpeg");
            const snapshot = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
            const related = await queryView({ view: fileDetailView, filter: { publicIds: [response.files[0]!.publicId, xFile.parseIdentity(original.publicId)] },
                cmdbQueryContext: "upload original and resized child" }, c.auth, snapshot);
            expect(related.items.find(file => file.publicId === returned.publicId)?.parentFile?.publicId).toBe(original.publicId);
            expect(related.items.find(file => file.publicId === original.publicId)?.childFiles?.map(file => file.publicId)).toEqual([returned.publicId]);
        } else {
            expect(returned.publicId).toBe(original.publicId);
            expect(returned.parentFileId).toBeNull();
            expect(await readFile(path.join(storage, returned.storedLeafName))).toEqual(bytes);
        }
    })));

    it("normalizes EXIF orientation in the resized child while preserving every original byte", () => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const originalFilename = "oriented.jpg", temporaryPath = path.join(incoming, originalFilename);
        const bytes = await sharp({ create: { width: 12, height: 40, channels: 3, background: "blue" } })
            .jpeg().withMetadata({ orientation: 6 }).toBuffer();
        await writeFile(temporaryPath, new Uint8Array(bytes));
        const response = await c.upload([{ originalFilename, temporaryPath, lastModifiedDate: null }], storage, { maxImageDimension: 10 });
        const child = await tx.file.findUniqueOrThrow({ where: { publicId: response.files[0]!.publicId } });
        const original = await tx.file.findUniqueOrThrow({ where: { id: child.parentFileId! } });
        expect(await readFile(path.join(storage, original.storedLeafName))).toEqual(bytes);
        expect(JSON.parse(child.customData!)).toEqual({ relationToParent: "forkedImage", imageMetadata: { width: 10, height: 3 } });
        const metadata = await sharp(await readFile(path.join(storage, child.storedLeafName))).metadata();
        expect(metadata).toMatchObject({ format: "jpeg", width: 10, height: 3 });
        expect(metadata.orientation).toBeUndefined();
    })));

    it("creates an upload child without granting File reads or unrelated association reads", () => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const readPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_files } });
        await tx.bandRolePermission.deleteMany({ where: { permissionId: readPermission.id } });
        const originalFilename = "upload-only.png", temporaryPath = path.join(incoming, originalFilename);
        await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toFile(temporaryPath);
        const response = await c.upload([{ originalFilename, temporaryPath, lastModifiedDate: null }], storage, {
            maxImageDimension: 10, taggedSongId: undefined, taggedEventId: undefined,
            taggedBandUserId: undefined, taggedInstrumentId: undefined,
        });
        const child = await tx.file.findUniqueOrThrow({ where: { publicId: response.files[0]!.publicId } });
        expect(child.parentFileId).not.toBeNull();
        expect((await c.auth.refresh(tx)).hasPermission(Permission.view_files)).toBe(false);
        expect(await readdir(storage)).toHaveLength(2);
    })));

    it("restricts the trusted upload-parent boundary to the actor's own active local File in the selected band", () => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const originalFilename = "owned-parent.png", temporaryPath = path.join(incoming, originalFilename);
        await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toFile(temporaryPath);
        const response = await c.upload([{ originalFilename, temporaryPath, lastModifiedDate: null }], storage);
        const parent = await tx.file.findUniqueOrThrow({ where: { publicId: response.files[0]!.publicId } });
        const snapshot = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        const changes = await tx.change.count();
        for (const patch of [{ bandId: fixture.bands[1]!.id }, { uploadedByUserId: fixture.admin.id },
            { isDeleted: true }, { externalURI: "https://example.com/photo.png" }]) {
            await expect(createUploadedImagePreview(snapshot, { ...parent, ...patch }, c.uploadArgs.visiblePermissionId ?? null,
                10, "must-not-be-read", [])).rejects.toThrow("own active local parent");
        }
        expect(await readdir(storage)).toEqual([parent.storedLeafName]);
        expect(await tx.change.count()).toBe(changes);
    })));

    it.each(["child insert", "child audit", "commit"])("rolls back both images and the original associations after failed %s", reason => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const originalFilename = "rollback-preview.png", temporaryPath = path.join(incoming, originalFilename);
        await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toFile(temporaryPath);
        const before = { files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileSongTag.count() };
        // DB3 uses the capitalized Prisma delegate, which has its own proxy identity.
        const fileDelegate: Prisma.TransactionClient["file"] = Reflect.get(tx, xFile.tableName);
        const originalInsert = fileDelegate.create.bind(fileDelegate), originalAudit = tx.change.create.bind(tx.change);
        const failure = reason === "child insert" ? vi.spyOn(fileDelegate, "create").mockImplementationOnce(args => originalInsert(args)).mockRejectedValueOnce(new Error(reason))
            : reason === "child audit" ? vi.spyOn(tx.change, "create").mockImplementationOnce(args => originalAudit(args)).mockRejectedValueOnce(new Error(reason)) : null;
        const failingCommit: DB3ReadRootDatabase = { $transaction: (work, options) => c.root.$transaction(async transaction => {
            await work(transaction);
            throw new Error("commit");
        }, options) };
        try {
            await expect(c.upload([{ originalFilename, temporaryPath, lastModifiedDate: null }], storage, { maxImageDimension: 10 },
                reason === "commit" ? failingCommit : c.root)).rejects.toThrow(reason);
        } finally {
            failure?.mockRestore();
        }
        expect(await readdir(storage)).toEqual([]);
        expect({ files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileSongTag.count() }).toEqual(before);
    })));

    it.each(["missing part", "invalid image", "commit failure"])("rolls back every File, association, audit and stored file after %s", reason => run(async (tx, fixture) => withStorage(async (storage, input) => {
        const c = await prepare(tx, fixture);
        const before = { files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileSongTag.count() };
        const part = { originalFilename: "first.pdf", temporaryPath: path.join(input, "first.pdf"), lastModifiedDate: null };
        await writeFile(part.temporaryPath, "score");
        const broken = { originalFilename: "broken.png", temporaryPath: path.join(input, "broken.png"), lastModifiedDate: null };
        if (reason === "invalid image") {
            await writeFile(broken.temporaryPath, "invalid image");
        }
        const failingCommit: DB3ReadRootDatabase = { $transaction: (work, options) => c.root.$transaction(async transaction => {
            await work(transaction);
            throw new Error("Commit failed");
        }, options) };
        await expect(c.upload(reason === "commit failure" ? [part] : [part, broken], storage, { maxImageDimension: 10 }, reason === "commit failure" ? failingCommit : c.root)).rejects.toThrow();
        expect(await readdir(storage)).toEqual([]);
        expect({ files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileSongTag.count() }).toEqual(before);
    })));

    it("rejects foreign and hidden parents, inactive members and catalogs before copying files", () => run(async (tx, fixture) => withStorage(async storage => {
        const c = await prepare(tx, fixture);
        const forbidden = { originalFilename: "first.pdf", temporaryPath: "must-not-be-read", lastModifiedDate: null };
        const before = await tx.change.count();
        await expect(c.upload([forbidden], storage, { taggedSongId: xSong.parseIdentity(c.foreign.publicId) })).rejects.toThrow();
        await tx.song.update({ where: { id: c.songs[0]!.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        await expect(c.upload([forbidden], storage)).rejects.toThrow();
        await tx.song.update({ where: { id: c.songs[0]!.id }, data: { visiblePermissionId: c.visibility.id } });
        await tx.bandInstrument.update({ where: { id: c.instrument.id }, data: { isHidden: true } });
        await expect(c.upload([forbidden], storage)).rejects.toThrow();
        await tx.bandInstrument.update({ where: { id: c.instrument.id }, data: { isHidden: false } });
        await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        await expect(c.upload([forbidden], storage)).rejects.toThrow();
        expect(await readdir(storage)).toEqual([]);
        expect(await tx.change.count()).toBe(before);
    })));

    it("refreshes upload grants and keeps independent band ownership", () => run(async (tx, fixture) => withStorage(async storage => {
        const c = await prepare(tx, fixture);
        const otherBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        await expect(c.upload([], storage, { bandPublicId: otherBand, externalURI: "https://example.com" })).rejects.toThrow();
        const otherPermissions = await tx.permission.findMany({ where: { name: { in: [Permission.upload_files, Permission.view_files, Permission.visibility_members] } } });
        const otherRole = await tx.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            bandRolePermissions: { create: otherPermissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
        } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: otherRole.id } });
        const otherAuth = await loadAuthorizationForUser(fixture.user, tx, otherBand);
        const result = await uploadFiles(c.root, otherAuth, { bandPublicId: otherBand, externalURI: "https://example.com" }, [], storage);
        expect((await tx.file.findUniqueOrThrow({ where: { publicId: result.files[0]!.publicId } })).bandId).toBe(fixture.bands[1]!.id);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.upload_files } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        await expect(c.upload([], storage, { externalURI: "https://example.com" })).rejects.toThrow();
        await expect(uploadFiles(c.root, otherAuth, { bandPublicId: otherBand, externalURI: "https://example.com/independent" }, [], storage)).resolves.toMatchObject({ isSuccess: true });
        expect(await readdir(storage)).toEqual([]);
    })));

    it("rejects empty or mixed uploads and keeps client storage inputs outside the public schema", () => run(async (tx, fixture) => withStorage(async storage => {
        const c = await prepare(tx, fixture);
        await expect(c.upload([], storage)).rejects.toBeInstanceOf(FileUploadInputError);
        await expect(c.upload([{ originalFilename: "x", temporaryPath: "unused", lastModifiedDate: null }], storage, { externalURI: "https://example.com" })).rejects.toBeInstanceOf(FileUploadInputError);
        expect(() => FileUploadArgsSchema.parse({ ...c.uploadArgs, temporaryPath: "secret" })).toThrow();
        expect(await readdir(storage)).toEqual([]);
    })));
});
