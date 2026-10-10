import { PrismaClient, type Prisma } from "@prisma/client";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { GetAuthorizedDirectDownloadFile } from "src/core/db3/server/fileDownload";
import { uploadFiles, type FileUploadPart } from "src/core/db3/server/fileUpload";
import { FileUploadResponseSchema, type FileUploadArgs } from "src/core/db3/shared/fileUpload";
import { loadSettingsSnapshot, writeSettings } from "src/setting/server/settings";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { songTransactionRoot } from "./support/songWorkflowMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const bandPublicId = parsePublicId<"Band">(fixture.bands[0]!.publicId);
    const otherBandPublicId = parsePublicId<"Band">(fixture.bands[1]!.publicId);
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } } });
    const role = await tx.bandRole.findUniqueOrThrow({ where: { id: member.bandRoleId! } });
    const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.upload_files, Permission.manage_site_branding,
        Permission.view_files, Permission.visibility_public] } } });
    const otherRole = await tx.bandRole.create({ data: { publicId: generatePublicId(), nameId: role.nameId,
        bandRolePermissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
    await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: otherRole.id } });
    const otherAuth = await loadAuthorizationForUser(fixture.user, tx, otherBandPublicId);
    const root = songTransactionRoot(tx);
    const args: FileUploadArgs = { bandPublicId, visiblePermission: Permission.visibility_public };
    const upload = (parts: readonly FileUploadPart[], storage: string, patch: Partial<FileUploadArgs> = {}, database = root) =>
        uploadFiles(database, auth, { ...args, ...patch }, parts, storage);
    return { auth, otherAuth, role, otherRole, root, args, upload, bandPublicId, otherBandPublicId };
}

async function withStorage(work: (storage: string, incoming: string) => Promise<void>): Promise<void> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "cmdb-branding-upload-"));
    const storage = path.join(directory, "stored"), incoming = path.join(directory, "incoming");
    await Promise.all([mkdir(storage), mkdir(incoming)]);
    try {
        await work(storage, incoming);
    } finally {
        // This private fixture owns these paths; never delete application uploads.
        if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("cmdb-branding-upload-")) {
            throw new Error("Unexpected branding upload fixture directory.");
        }
        await rm(directory, { recursive: true, force: true });
    }
}

describe.skipIf(!settingsMysqlTestUrl)("band branding uploads on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("retains PNG, SVG and ICO bytes, server metadata and shared uploader identity without membership tags", () => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const png = await sharp({ create: { width: 1000, height: 500, channels: 4, background: "red" } }).png().toBuffer();
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" fill="blue"/></svg>');
        // An ICO entry may contain PNG pixels. Sharp does not decode this container, but downloads retain it.
        const iconPng = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).png().toBuffer();
        const icoHeader = Buffer.alloc(22); icoHeader.writeUInt16LE(1, 2); icoHeader.writeUInt16LE(1, 4);
        icoHeader[6] = 16; icoHeader[7] = 16; icoHeader.writeUInt16LE(1, 10); icoHeader.writeUInt16LE(32, 12);
        icoHeader.writeUInt32LE(iconPng.length, 14); icoHeader.writeUInt32LE(22, 18);
        const buffers = [png, svg, Buffer.concat([new Uint8Array(icoHeader), new Uint8Array(iconPng)])];
        const parts = ["logo.png", "logo.svg", "favicon.ico"].map(originalFilename => ({ originalFilename, temporaryPath: path.join(incoming, originalFilename), lastModifiedDate: null }));
        await Promise.all(parts.map((part, index) => writeFile(part.temporaryPath, new Uint8Array(buffers[index]!))));
        const personBefore = await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
        const membersBefore = await tx.bandUser.findMany({ where: { userId: fixture.user.id }, orderBy: { id: "asc" } });
        const result = FileUploadResponseSchema.parse(await c.upload(parts, storage));
        expect(result.files).toHaveLength(3);
        for (const [index, dto] of result.files.entries()) {
            expect(await readFile(path.join(storage, dto.storedLeafName))).toEqual(buffers[index]);
            const file = await tx.file.findUniqueOrThrow({ where: { publicId: dto.publicId }, include: { taggedUsers: true } });
            expect(file).toMatchObject({ bandId: fixture.bands[0]!.id, uploadedByUserId: fixture.user.id, externalURI: null, taggedUsers: [] });
            expect(dto.uploadedByUserId).toBe(personBefore.publicId);
            expect(file.visiblePermissionId).toBe((await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_public } })).id);
            expect(file.sizeBytes).toBe(buffers[index]!.length);
        }
        expect(JSON.parse(result.files[0]!.customData!)).toEqual({ imageMetadata: { width: 1000, height: 500 } });
        expect(JSON.parse(result.files[1]!.customData!)).toEqual({ imageMetadata: { width: 400, height: 80 } });
        expect(result.files[2]!.customData).toBeNull();
        expect(await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).toEqual(personBefore);
        expect(await tx.bandUser.findMany({ where: { userId: fixture.user.id }, orderBy: { id: "asc" } })).toEqual(membersBefore);
        expect(await tx.change.count({ where: { table: "File", userId: fixture.user.id } })).toBe(3);
        expect(await tx.bandSetting.count({ where: { bandId: fixture.bands[0]!.id } })).toBe(0);
    })));

    it("publishes and resets logo/favicon settings separately from uploading, with fresh public and foreign-band reads", () => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const part = { originalFilename: "logo.svg", temporaryPath: path.join(incoming, "logo.svg"), lastModifiedDate: null };
        await writeFile(part.temporaryPath, '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"/>');
        const result = await c.upload([part], storage);
        const file = result.files[0]!;
        const uri = `/api/files/download/${file.storedLeafName}?bandPublicId=${c.bandPublicId}`;
        await writeSettings(tx, await c.auth.refresh(tx), [{ hive: "band", key: "siteCustomization.logoUrl", operation: { kind: "set", value: uri } },
            { hive: "band", key: "siteCustomization.faviconUrl", operation: { kind: "set", value: uri } }], CreateChangeContext("branding-save"));
        expect((await loadSettingsSnapshot(tx, c.auth)).band["siteCustomization.logoUrl"]?.value).toBe(uri);
        expect((await loadSettingsSnapshot(tx, c.otherAuth)).band["siteCustomization.logoUrl"]?.value).toBe("");
        const publicAuth = await loadAuthorizationForUser(null, tx, c.bandPublicId);
        const publicContext = await bindDB3ReadSnapshot(tx, publicAuth, { isolationLevel: "Serializable" });
        expect(await GetAuthorizedDirectDownloadFile(file.storedLeafName, publicAuth, publicContext)).toMatchObject({ publicId: file.publicId });
        const otherContext = await bindDB3ReadSnapshot(tx, c.otherAuth, { isolationLevel: "Serializable" });
        expect(await GetAuthorizedDirectDownloadFile(file.storedLeafName, c.otherAuth, otherContext)).toBeNull();
        await tx.file.update({ where: { publicId: file.publicId }, data: { visiblePermissionId: null } });
        expect(await GetAuthorizedDirectDownloadFile(file.storedLeafName, publicAuth, publicContext)).toBeNull();
        await writeSettings(tx, await c.auth.refresh(tx), [{ hive: "band", key: "siteCustomization.logoUrl", operation: { kind: "reset" } },
            { hive: "band", key: "siteCustomization.faviconUrl", operation: { kind: "set", value: "" } }], CreateChangeContext("branding-reset"));
        expect((await loadSettingsSnapshot(tx, c.auth)).band["siteCustomization.logoUrl"]).toMatchObject({ value: "", source: "default" });
        expect((await loadSettingsSnapshot(tx, c.auth)).band["siteCustomization.faviconUrl"]).toMatchObject({ value: "", source: "stored" });
        expect(await tx.file.count({ where: { publicId: file.publicId } })).toBe(1);
        expect(await readdir(storage)).toEqual([file.storedLeafName]);
    })));

    it("rejects a freshly revoked upload grant before touching storage while another band still uploads", () => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.upload_files } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        const part = { originalFilename: "logo.svg", temporaryPath: "must-not-be-read", lastModifiedDate: null };
        const before = { files: await tx.file.count(), changes: await tx.change.count() };
        await expect(c.upload([part], storage)).rejects.toThrow();
        expect(await readdir(storage)).toEqual([]);
        expect({ files: await tx.file.count(), changes: await tx.change.count() }).toEqual(before);
        const otherPart = { ...part, temporaryPath: path.join(incoming, "logo.svg") };
        await writeFile(otherPart.temporaryPath, '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30"/>');
        const result = await uploadFiles(c.root, c.otherAuth, { bandPublicId: c.otherBandPublicId, visiblePermission: Permission.visibility_public }, [otherPart], storage);
        expect(await tx.file.findUniqueOrThrow({ where: { publicId: result.files[0]!.publicId } })).toMatchObject({ bandId: fixture.bands[1]!.id });
    })));

    it("retains an uploaded File and previous published URL when branding authority is revoked before save", () => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const key = "siteCustomization.logoUrl";
        await writeSettings(tx, c.auth, [{ hive: "band", key, operation: { kind: "set", value: "/previous.svg" } }], CreateChangeContext("branding-before"));
        const part = { originalFilename: "new.svg", temporaryPath: path.join(incoming, "new.svg"), lastModifiedDate: null };
        await writeFile(part.temporaryPath, '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30"/>');
        const result = await c.upload([part], storage);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_site_branding } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        const before = await tx.change.count();
        await expect(writeSettings(tx, await c.auth.refresh(tx), [{ hive: "band", key,
            operation: { kind: "set", value: `/api/files/download/${result.files[0]!.storedLeafName}?bandPublicId=${c.bandPublicId}` } }], CreateChangeContext("branding-denied"))).rejects.toThrow();
        expect((await loadSettingsSnapshot(tx, c.auth)).band[key]?.value).toBe("/previous.svg");
        expect(await tx.change.count()).toBe(before);
        expect(await tx.file.count({ where: { publicId: result.files[0]!.publicId } })).toBe(1);
        await writeSettings(tx, await c.otherAuth.refresh(tx), [{ hive: "band", key,
            operation: { kind: "set", value: "https://example.com/other.svg" } }], CreateChangeContext("branding-other"));
        expect((await loadSettingsSnapshot(tx, c.otherAuth)).band[key]?.value).toBe("https://example.com/other.svg");
    })));

    it.each(["missing part", "invalid image", "commit failure"])("cleans all File rows, audits and bytes after %s", reason => run(async (tx, fixture) => withStorage(async (storage, incoming) => {
        const c = await prepare(tx, fixture);
        const part = { originalFilename: "logo.png", temporaryPath: path.join(incoming, "logo.png"), lastModifiedDate: null };
        const broken = { originalFilename: "broken.png", temporaryPath: path.join(incoming, "broken.png"), lastModifiedDate: null };
        await sharp({ create: { width: 80, height: 40, channels: 4, background: "blue" } }).png().toFile(part.temporaryPath);
        if (reason === "invalid image") {
            await writeFile(broken.temporaryPath, "invalid image");
        }
        const failingCommit: DB3ReadRootDatabase = { $transaction: (work, options) => c.root.$transaction(async transaction => {
            await work(transaction);
            throw new Error("Commit failed");
        }, options) };
        const before = { files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileUserTag.count() };
        // Exercise the shared image processor's optional resize policy independently of branding's original-byte policy.
        await expect(c.upload(reason === "commit failure" ? [part] : [part, broken], storage,
            reason === "invalid image" ? { maxImageDimension: 10 } : {}, reason === "commit failure" ? failingCommit : c.root)).rejects.toThrow();
        expect(await readdir(storage)).toEqual([]);
        expect({ files: await tx.file.count(), changes: await tx.change.count(), associations: await tx.fileUserTag.count() }).toEqual(before);
        expect(await readFile(part.temporaryPath)).not.toHaveLength(0);
        expect(await tx.bandSetting.count({ where: { bandId: fixture.bands[0]!.id } })).toBe(0);
    })));
});
