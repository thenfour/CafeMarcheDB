import { PrismaClient, type Prisma } from "@prisma/client";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { FileUploadInputError, uploadFiles, type FileUploadPart } from "src/core/db3/server/fileUpload";
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
        expect(await readdir(storage)).toHaveLength(3);
        const files = await tx.file.findMany({ where: { publicId: { in: result.files.map(file => file.publicId) } }, include: { tags: { include: { bandFileTag: { include: { globalFileTag: true } } } }, taggedInstruments: true } });
        const pdf = files.find(file => file.fileLeafName === names[0])!;
        expect(pdf.tags.map(tag => tag.bandFileTag.globalFileTag?.significance)).toEqual(["Partition"]);
        expect(pdf.taggedInstruments).toMatchObject([{ bandInstrumentId: c.instrument.id }]);
        expect(files.find(file => file.fileLeafName === names[1])?.tags.map(tag => tag.bandFileTag.globalFileTag?.significance)).toEqual(["Recording"]);
        const image = files.find(file => file.fileLeafName === names[2])!;
        expect(JSON.parse(image.customData!)).toEqual({ imageMetadata: { width: 10, height: 5 } });
        expect((await readFile(path.join(storage, image.storedLeafName))).length).toBe(image.sizeBytes);
        expect(await tx.change.count({ where: { table: "File", recordId: { in: files.map(file => file.id) } } })).toBe(3);
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
