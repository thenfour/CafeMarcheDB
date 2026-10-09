import { PrismaClient, type Prisma } from "@prisma/client";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { fileDetailView, xFile } from "src/core/db3/db3";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { forkImage } from "src/core/db3/server/imageFork";
import { ForkImageResultSchema, type ImageForkInput } from "src/core/db3/shared/imageFork";
import { MakeDefaultImageEditParams } from "src/core/db3/shared/fileTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { songTransactionRoot } from "./support/songWorkflowMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function withStorage(work: (directory: string) => Promise<void>) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "cmdb-image-fork-"));
    try {
        await work(directory);
    } finally {
        // Delete only the exact private directory created by this fixture.
        if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("cmdb-image-fork-")) {
            throw new Error("Unexpected private image fixture directory.");
        }
        await rm(directory, { recursive: true, force: true });
    }
}

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, directory: string,
    dimensions = { width: 60, height: 40 },
) {
    const c = await prepareEventAttendanceFixture(tx, fixture,
        [Permission.upload_files, Permission.view_files, Permission.visibility_members, Permission.access_file_landing_page]);
    const pixels = new Uint8Array(dimensions.width * dimensions.height * 3);
    for (let y = 0; y < dimensions.height; y++) {
        for (let x = 0; x < dimensions.width; x++) {
            pixels.set(x < dimensions.width / 2 ? [200, 5, 7] : [5, 7, 200], (y * dimensions.width + x) * 3);
        }
    }
    const contents = await sharp(pixels, { raw: { ...dimensions, channels: 3 } }).png().toBuffer();
    const leaf = generatePublicId() + ".png";
    await writeFile(path.join(directory, leaf), new Uint8Array(contents));
    const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const source = await tx.file.create({ data: {
        publicId: generatePublicId(), bandId: c.band.id, fileLeafName: "original.png", storedLeafName: leaf,
        uploadedByUserId: fixture.user.id, uploadedAt: new Date(), visiblePermissionId: permission.id,
        mimeType: "image/png", sizeBytes: contents.length, description: "",
        // Stale metadata must never determine the decoder's crop bounds.
        customData: JSON.stringify({ imageMetadata: { width: 600, height: 400 } }),
    } });
    const input: ImageForkInput = {
        bandPublicId: c.args.bandPublicId, parentFileId: xFile.parseIdentity(source.publicId),
        outputType: "png", quality: 80, editParams: MakeDefaultImageEditParams(),
    };
    const root = songTransactionRoot(tx);
    return { ...c, source, input, root, permission, contents, dimensions,
        fork: (patch: Partial<ImageForkInput> = {}, auth = c.auth, database = root) =>
            forkImage(database, auth, { ...input, ...patch }, directory),
        output: (publicId: string) => tx.file.findUniqueOrThrow({ where: { publicId } }),
    };
}

describe.skipIf(!settingsMysqlTestUrl)("image forks on MariaDB and real storage", () => {
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
            throw new Error("A disposable image database is required.");
        }
        return withSettingsMysqlFixture(database, (tx, fixture) => withStorage(directory => work(tx, fixture, directory)));
    };

    it("creates an audited public-ID child with actor/band/visibility and actual output metadata", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const result = await c.fork();
        expect(ForkImageResultSchema.parse(result)).toEqual(result);
        expect(Object.keys(result)).toEqual(["publicId"]);
        const file = await c.output(result.publicId);
        const bytes = await readFile(path.join(directory, file.storedLeafName));
        expect(file).toMatchObject({ bandId: c.band.id, uploadedByUserId: fixture.user.id, parentFileId: c.source.id,
            fileLeafName: "original_.png", mimeType: "image/png", sizeBytes: bytes.length,
            visiblePermissionId: c.permission.id, previewFileId: null, externalURI: null });
        expect(JSON.parse(file.customData!)).toEqual({
            relationToParent: "forkedImage", forkedImage: { creationEditParams: c.input.editParams },
            imageMetadata: { width: 60, height: 40 },
        });
        expect(await tx.change.count({ where: { table: "File", recordId: file.id } })).toBe(1);
        expect(await readFile(path.join(directory, c.source.storedLeafName))).toEqual(c.contents);
        const snapshot = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
        const resultRows = await queryView({ view: fileDetailView, filter: { publicIds: [result.publicId, c.input.parentFileId] },
            cmdbQueryContext: "fork relationships" }, c.auth, snapshot);
        expect(resultRows.items.find(item => item.publicId === result.publicId)?.parentFile?.publicId).toBe(c.input.parentFileId);
        expect(resultRows.items.find(item => item.publicId === c.input.parentFileId)?.childFiles?.map(child => child.publicId)).toEqual([result.publicId]);
    }));

    it.each([
        { name: "crop", patch: { editParams: { cropBegin: { x: 10, y: 5 }, cropSize: { width: 20, height: 15 }, rotate: 0 } }, width: 20, height: 15 },
        { name: "resize", patch: { newDimensions: { width: 12, height: 8 } }, width: 12, height: 8 },
        { name: "clockwise rotation", patch: { editParams: { ...MakeDefaultImageEditParams(), rotate: 90 } }, width: 40, height: 60 },
        { name: "counterclockwise rotation", patch: { editParams: { ...MakeDefaultImageEditParams(), rotate: -90 } }, width: 40, height: 60 },
    ])("applies $name to the physical pixels", ({ patch, width, height }) => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const result = await c.fork(patch);
        const file = await c.output(result.publicId);
        expect(await sharp(await readFile(path.join(directory, file.storedLeafName))).metadata()).toMatchObject({ width, height });
        expect(JSON.parse(file.customData!).imageMetadata).toEqual({ width, height });
    }));

    it("crops and resizes before rotation and preserves clockwise pixel placement", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const result = await c.fork({ editParams: { cropBegin: { x: 10, y: 10 }, cropSize: { width: 40, height: 20 }, rotate: 90 },
            newDimensions: { width: 20, height: 10 } });
        const file = await c.output(result.publicId);
        const image = await sharp(await readFile(path.join(directory, file.storedLeafName))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        expect(image.info).toMatchObject({ width: 10, height: 20, channels: 3 });
        expect([...image.data.subarray(0, 3)]).toEqual([200, 5, 7]);
        expect([...image.data.subarray(image.data.length - 3)]).toEqual([5, 7, 200]);
    }));

    it("keeps tiny and fractional edge crops inside the decoder bounds", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory, { width: 4, height: 3 });
        const tiny = await c.output((await c.fork()).publicId);
        expect(await sharp(await readFile(path.join(directory, tiny.storedLeafName))).metadata()).toMatchObject({ width: 4, height: 3 });
        await sharp({ create: { width: 60, height: 40, channels: 3, background: "red" } }).png().toFile(path.join(directory, c.source.storedLeafName));
        const fractional = await c.output((await c.fork({
            editParams: { cropBegin: { x: 1.5, y: 2.5 }, cropSize: { width: 100, height: 100 }, rotate: 0 },
        })).publicId);
        expect(await sharp(await readFile(path.join(directory, fractional.storedLeafName))).metadata()).toMatchObject({ width: 58, height: 37 });
    }));

    it("normalizes EXIF orientation before determining crop coordinates", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        await sharp({ create: { width: 60, height: 40, channels: 3, background: "red" } })
            .jpeg().withMetadata({ orientation: 6 }).toFile(path.join(directory, c.source.storedLeafName));
        const file = await c.output((await c.fork()).publicId);
        expect(await sharp(await readFile(path.join(directory, file.storedLeafName))).metadata()).toMatchObject({ width: 40, height: 60, format: "png" });
    }));

    it.each(["png", "jpg", "webp"] as const)("encodes %s with matching filename, MIME, size and decoder format", format => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const file = await c.output((await c.fork({ outputType: format })).publicId);
        const expected = { png: ["image/png", "png"], jpg: ["image/jpeg", "jpeg"], webp: ["image/webp", "webp"] }[format];
        expect(file.fileLeafName).toBe("original_." + format);
        expect(file.storedLeafName.endsWith("." + format)).toBe(true);
        expect(file.mimeType).toBe(expected[0]);
        expect(await sharp(await readFile(path.join(directory, file.storedLeafName))).metadata()).toMatchObject({ format: expected[1] });
    }));

    it("honors lossy encoder quality", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const pixels = Uint8Array.from({ length: 120 * 80 * 3 }, (_, index) => (index * 29 + Math.floor(index / 17) * 67) % 256);
        await sharp(pixels, { raw: { width: 120, height: 80, channels: 3 } }).png().toFile(path.join(directory, c.source.storedLeafName));
        const low = await c.output((await c.fork({ outputType: "jpg", quality: 10 })).publicId);
        const high = await c.output((await c.fork({ outputType: "jpg", quality: 95 })).publicId);
        expect(low.sizeBytes).toBeLessThan(high.sizeBytes!);
    }));

    it("accounts for HEIC encoder availability without keeping failed outputs", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const result = await c.fork({ outputType: "heic" }).catch(error => {
            expect(String(error)).toMatch(/heifsave|Unsupported compression|hevc/i);
            return null;
        });
        if (result) {
            const file = await c.output(result.publicId);
            expect(file.mimeType).toBe("image/heic");
            expect(await sharp(await readFile(path.join(directory, file.storedLeafName))).metadata()).toMatchObject({ format: "heif" });
        } else {
            expect(await tx.file.count()).toBe(1);
            expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
        }
    }));

    it("supports forks of forks without reusing storage or flattening the parent", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const first = await c.output((await c.fork()).publicId);
        const second = await c.output((await c.fork({ parentFileId: xFile.parseIdentity(first.publicId) })).publicId);
        expect(second.parentFileId).toBe(first.id);
        expect(second.fileLeafName).toBe("original__.png");
        expect(new Set([c.source.storedLeafName, first.storedLeafName, second.storedLeafName]).size).toBe(3);
    }));

    it.each(["private", "deleted", "foreign", "external", "nonimage", "missing"] as const)(
        "rejects %s sources without writing outputs or audits", kind => run(async (tx, fixture, directory) => {
            const c = await prepare(tx, fixture, directory);
            const patch = {
                private: { visiblePermissionId: null, uploadedByUserId: fixture.admin.id },
                deleted: { isDeleted: true },
                foreign: { bandId: fixture.bands[1]!.id },
                external: { externalURI: "https://example.com/image.png" },
                nonimage: { mimeType: "application/pdf" },
                missing: { publicId: generatePublicId() },
            }[kind];
            await tx.file.update({ where: { id: c.source.id }, data: patch });
            const cutoff = await tx.change.count();
            await expect(c.fork()).rejects.toThrow("Source image was not found");
            expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
            expect(await tx.change.count()).toBe(cutoff);
            expect(await tx.file.count()).toBe(1);
        }),
    );

    it("checks fresh upload permission before looking up or opening the source", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.upload_files } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        const lookup = vi.spyOn(tx.file, "findMany");
        try {
            await expect(c.fork()).rejects.toThrow("upload_files");
            expect(lookup).not.toHaveBeenCalled();
        } finally {
            lookup.mockRestore();
        }
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it("refreshes roleless/deleted/merged principals and band state", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        for (const data of [{ bandRoleId: null }, { isDeleted: true }]) {
            await tx.bandUser.update({ where: { id: c.member.id }, data });
            await expect(c.fork()).rejects.toThrow();
            await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: c.role.id, isDeleted: false } });
        }
        for (const data of [{ isDeleted: true }, { mergedIntoUserId: fixture.admin.id }]) {
            await tx.user.update({ where: { id: fixture.user.id }, data });
            await expect(c.fork()).rejects.toThrow();
            await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: false, mergedIntoUserId: null } });
        }
        await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        await expect(c.fork()).rejects.toThrow();
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it("requires explicit selected-band authority for anonymous, outsider and platform users", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const anonymous = await loadAuthorizationForUser(null, tx, c.input.bandPublicId);
        await expect(c.fork({}, anonymous)).rejects.toThrow();
        const outsider = await tx.user.create({ data: { publicId: generatePublicId(), name: "Outside", email: "image-outside@test.invalid" } });
        await expect(c.fork({}, await loadAuthorizationForUser(outsider, tx, c.input.bandPublicId))).rejects.toThrow();
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(c.fork({}, platform)).rejects.toThrow();
        await expect(c.fork({ bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow("selected band");
        const selected = await loadAuthorizationForUser(fixture.admin, tx, c.input.bandPublicId);
        expect((await c.output((await c.fork({}, selected)).publicId)).bandId).toBe(c.band.id);
    }));

    it("keeps independent second-band grants after first-band revocation", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const secondBand = fixture.bands[1]!;
        const grants = await tx.permission.findMany({ where: { name: { in: [Permission.upload_files, Permission.visibility_members] } } });
        const role = await tx.bandRole.create({ data: { publicId: generatePublicId(),
            name: { create: { publicId: generatePublicId() } },
            bandRolePermissions: { create: grants.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) },
        } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: secondBand.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
        const secondLeaf = generatePublicId() + ".png";
        await writeFile(path.join(directory, secondLeaf), new Uint8Array(c.contents));
        const source = await tx.file.create({ data: { ...c.source, id: undefined, publicId: generatePublicId(),
            storedLeafName: secondLeaf, bandId: secondBand.id } });
        const bandPublicId = parsePublicId<"Band">(secondBand.publicId);
        const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
        const grant = grants.find(permission => permission.name === Permission.upload_files)!;
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: grant.id } });
        await expect(c.fork()).rejects.toThrow("upload_files");
        const file = await c.output((await c.fork({ bandPublicId, parentFileId: xFile.parseIdentity(source.publicId) }, auth)).publicId);
        expect(file).toMatchObject({ bandId: secondBand.id, uploadedByUserId: fixture.user.id, parentFileId: source.id });
    }));

    it("preserves owner-only private visibility independently for the fork", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        await tx.file.update({ where: { id: c.source.id }, data: { visiblePermissionId: null } });
        const admin = await loadAuthorizationForUser(fixture.admin, tx, c.input.bandPublicId);
        const file = await c.output((await c.fork()).publicId);
        expect(file).toMatchObject({ visiblePermissionId: null, uploadedByUserId: fixture.user.id });
        await expect(c.fork({}, admin)).rejects.toThrow("Source image was not found");
        const snapshot = await bindDB3ReadSnapshot(tx, admin, { isolationLevel: "Serializable" });
        const hidden = await queryView({ view: fileDetailView, filter: { publicIds: [xFile.parseIdentity(file.publicId)] },
            cmdbQueryContext: "private fork" }, admin, snapshot);
        expect(hidden.items).toEqual([]);
    }));

    it("cleans copied storage and rolls back File/audit rows after a failed commit", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const cutoff = await tx.change.count();
        const failedCommit: DB3ReadRootDatabase = { $transaction: work => c.root.$transaction(async transaction => {
            await work(transaction);
            throw new Error("Failed image commit");
        }, { isolationLevel: "Serializable" }) };
        await expect(c.fork({}, c.auth, failedCommit)).rejects.toThrow("Failed image commit");
        expect(await tx.file.count()).toBe(1);
        expect(await tx.change.count()).toBe(cutoff);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
        expect(await readFile(path.join(directory, c.source.storedLeafName))).toEqual(c.contents);
    }));

    it.each(["file", "audit"] as const)("cleans outputs after a failed %s insert", kind => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        const cutoff = await tx.change.count();
        // Prisma's capitalized delegate is a distinct proxy; DB3 uses the declared File table name.
        const fileDelegate: Prisma.TransactionClient["file"] = Reflect.get(tx, xFile.tableName);
        const failure = kind === "file" ? vi.spyOn(fileDelegate, "create") : vi.spyOn(tx.change, "create");
        failure.mockRejectedValueOnce(new Error("Failed image insert"));
        try {
            await expect(c.fork()).rejects.toThrow("Failed image insert");
        } finally {
            failure.mockRestore();
        }
        expect(await tx.file.count()).toBe(1);
        expect(await tx.change.count()).toBe(cutoff);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));

    it("rejects corrupt image data and unsafe stored leaves without orphaned outputs", () => run(async (tx, fixture, directory) => {
        const c = await prepare(tx, fixture, directory);
        await writeFile(path.join(directory, c.source.storedLeafName), "Not an image");
        await expect(c.fork()).rejects.toThrow();
        await tx.file.update({ where: { id: c.source.id }, data: { storedLeafName: "../secret.png" } });
        await expect(c.fork()).rejects.toThrow("Invalid stored file name");
        expect(await tx.file.count()).toBe(1);
        expect(await readdir(directory)).toEqual([c.source.storedLeafName]);
    }));
});
