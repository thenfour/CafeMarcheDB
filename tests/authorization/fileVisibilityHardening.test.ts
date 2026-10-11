import type { File } from "@prisma/client";
import * as filesystem from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});
vi.mock("send", () => ({ default: vi.fn() }));
vi.mock("node:fs/promises", async () => {
    const actual = await vi.importActual<typeof filesystem>("node:fs/promises");
    return { ...actual, readFile: vi.fn(actual.readFile) };
});

import send from "send";
import { Permission, gPermissionRegistry } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import forkImageMutation from "src/core/db3/mutations/forkImage";
import updateGalleryItemImageMutation from "src/core/db3/mutations/updateGalleryItemImage";
import { GetFileServerStoragePath } from "src/core/db3/server/db3mutationCore";
import { GetAuthorizedDirectDownloadFile, SendFileDownload, ServeAuthorizedFileDownload } from "src/core/db3/server/fileDownload";
import { forkImage } from "src/core/db3/server/imageFork";
import { updateGalleryItemImage } from "src/core/db3/server/galleryImage";
import { MakeDefaultImageEditParams } from "src/core/db3/shared/fileTypes";
import type { DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import type { ImageForkInput } from "src/core/db3/shared/imageFork";
import type { GalleryImageInput } from "src/core/db3/shared/galleryImage";
import { filePublicId } from "../support/fileFixtures";
import { galleryPublicId } from "../support/galleryFixtures";
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const bandPublicId = parsePublicId<"Band">("FileAuthBand0001");
// The fixture proxy implements Prisma's transaction callback at runtime, beyond its dynamic delegate type.
const fileDatabase = authorizationTestDb as unknown as DB3ReadRootDatabase;
const permissionId = (name: Permission) => gPermissionRegistry.findIndex(entry => entry.key === name) + 1;
const publicPermissionId = permissionId(Permission.visibility_public);
const publicPermissions = [Permission.always_grant, Permission.public, Permission.visibility_public,
    Permission.view_events, Permission.view_files, Permission.practice_tools_use];
const makeFile = (overrides: Partial<File> = {}): File => ({
    id: 10, publicId: filePublicId(10), bandId: 1, fileLeafName: "photo.jpg", storedLeafName: "stored-photo.jpg",
    description: "", isDeleted: false, uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
    uploadedByUserId: null, visiblePermissionId: publicPermissionId, externalURI: null, fileCreatedAt: null,
    mimeType: "image/jpeg", customData: null, parentFileId: null, previewFileId: null, sizeBytes: null, ...overrides,
});

/** Persist band grants so each reader and transaction owner refreshes database authority. */
function seedFileAccess(files: File[], actorId: number | null, grants: Permission[]) {
    const actor = actorId === null ? null : createAuthorizationTestUser("normal", { id: actorId, permissions: grants });
    authorizationTestDb.reset({
        user: actor ? [{ ...actor, globalRoleId: null }] : [],
        band: [{ id: 1, publicId: bandPublicId, isDeleted: false }],
        bandUser: actor ? [{ id: 1, publicId: "FileAuthMember01", userId: actor.id, bandId: 1, bandRoleId: 20, isDeleted: false }] : [],
        bandRole: [{ id: 10, isPublicRole: true, isDeleted: false }, { id: 20, isDeleted: false }],
        permission: gPermissionRegistry.map((entry, index) => ({ id: index + 1,
            publicId: "FilePerm" + String(index + 1).padStart(8, "0"), name: entry.key, isDeleted: false })),
        bandRolePermission: [...publicPermissions.map(name => ({ bandRoleId: 10, permissionId: permissionId(name) })),
            ...grants.map(name => ({ bandRoleId: 20, permissionId: permissionId(name) }))].map((entry, index) => ({ id: index + 1, ...entry })),
        file: files, frontpageGalleryItem: [],
    });
    return actorId === null ? createAuthorizationPersona("public").ctx
        : createAuthorizationPersona("normal", { id: actorId, permissions: grants }).ctx;
}

beforeEach(() => {
    vi.clearAllMocks();
    seedFileAccess([], null, []);
});
afterEach(() => {
    vi.restoreAllMocks();
});

function mockFileStream() {
    const handlers = new Map<string, () => void>();
    const stream = {
        on: vi.fn((event: string, handler: () => void) => {
            handlers.set(event, handler);
            return stream;
        }),
        pipe: vi.fn(() => handlers.get("end")?.()),
    };
    // The streamer uses only event registration and piping from send's native stream.
    vi.mocked(send).mockReturnValue(stream as ReturnType<typeof send>);
}

async function withStorageSetting(work: () => Promise<void>) {
    const previous = process.env.FILE_UPLOAD_PATH;
    process.env.FILE_UPLOAD_PATH = "C:\\file-storage";
    try {
        await work();
    } finally {
        if (previous === undefined) {
            delete process.env.FILE_UPLOAD_PATH;
        } else {
            process.env.FILE_UPLOAD_PATH = previous;
        }
    }
}

describe("BA-S002 direct and parent-authorized file delivery", () => {
    it("allows only active, visible local files in the selected band through the direct download lookup", async () => {
        const ctx = seedFileAccess([makeFile(),
            makeFile({ id: 11, publicId: filePublicId(11), storedLeafName: "hidden.jpg", visiblePermissionId: permissionId(Permission.visibility_editors) }),
            makeFile({ id: 12, publicId: filePublicId(12), storedLeafName: "deleted.jpg", isDeleted: true }),
            makeFile({ id: 13, publicId: filePublicId(13), storedLeafName: "foreign.jpg", bandId: 2 }),
            makeFile({ id: 14, publicId: filePublicId(14), storedLeafName: "external.jpg", externalURI: "https://example.com/image.jpg" }),
        ], null, []);
        const auth = await loadAuthorization(ctx.session, bandPublicId);
        await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", auth)).resolves.toEqual(expect.objectContaining({ publicId: filePublicId(10) }));
        for (const leaf of ["hidden.jpg", "deleted.jpg", "foreign.jpg", "external.jpg", "absent.jpg"]) {
            await expect(GetAuthorizedDirectDownloadFile(leaf, auth)).resolves.toBeNull();
        }
    });

    it("allows a private file only to its uploader", async () => {
        const ctx = seedFileAccess([makeFile({ uploadedByUserId: 30, visiblePermissionId: null })], 30,
            [Permission.login, Permission.view_files, Permission.upload_files]);
        await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", await loadAuthorization(ctx.session, bandPublicId)))
            .resolves.toEqual(expect.objectContaining({ publicId: filePublicId(10) }));
        const publicCtx = createAuthorizationPersona("public").ctx;
        await expect(GetAuthorizedDirectDownloadFile("stored-photo.jpg", await loadAuthorization(publicCtx.session, bandPublicId))).resolves.toBeNull();
    });

    it("streams HTML at an alias only for the same viewers as the file URL", async () => {
        const ctx = seedFileAccess([makeFile({ fileLeafName: "mypage.html", storedLeafName: "stored-page.html",
            uploadedByUserId: 30, visiblePermissionId: null })], 30, [Permission.login, Permission.view_files, Permission.upload_files]);
        const publicCtx = createAuthorizationPersona("public").ctx;
        mockFileStream();
        const request = { headers: { range: "bytes=10-19" }, url: "/MyPage" };
        const response = () => ({ statusCode: 200, headersSent: false, setHeader: vi.fn(), end: vi.fn() });
        const publicResponse = response(), ownerResponse = response();
        await withStorageSetting(async () => {
            // These doubles expose only the native HTTP members used by the download service.
            await ServeAuthorizedFileDownload(request as Parameters<typeof ServeAuthorizedFileDownload>[0],
                publicResponse as unknown as Parameters<typeof ServeAuthorizedFileDownload>[1], await loadAuthorization(publicCtx.session, bandPublicId), "stored-page.html");
            expect(publicResponse.statusCode).toBe(404);
            expect(publicResponse.end).toHaveBeenCalledOnce();
            expect(send).not.toHaveBeenCalled();
            // Native streaming is replaced by mockFileStream; the same request retains its range header.
            await ServeAuthorizedFileDownload(request as Parameters<typeof ServeAuthorizedFileDownload>[0],
                ownerResponse as unknown as Parameters<typeof ServeAuthorizedFileDownload>[1], await loadAuthorization(ctx.session, bandPublicId), "stored-page.html");
        });
        expect(send).toHaveBeenCalledWith(request, "stored-page.html", expect.any(Object));
        expect(ownerResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/html");
        expect(ownerResponse.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining("inline;"));
        expect(request.headers.range).toBe("bytes=10-19");
    });

    it("retains the original request when delegating range-capable streaming", async () => {
        mockFileStream();
        const request = { headers: { range: "bytes=10-19" } };
        const response = { headersSent: false, setHeader: vi.fn(), end: vi.fn() };
        await withStorageSetting(async () => {
            // The stream double only needs the headers and completion members used by SendFileDownload.
            await SendFileDownload(request as Parameters<typeof SendFileDownload>[0],
                response as unknown as Parameters<typeof SendFileDownload>[1], { ...makeFile(), publicId: filePublicId(10) });
        });
        expect(send).toHaveBeenCalledWith(request, "stored-photo.jpg", expect.objectContaining({ dotfiles: "deny" }));
        expect(request.headers.range).toBe("bytes=10-19");
    });

    it("rejects path-shaped storage names", async () => withStorageSetting(async () => {
        for (const leaf of ["../private.txt", "folder/private.txt", "folder\\private.txt"]) {
            expect(() => GetFileServerStoragePath(leaf)).toThrow("Invalid stored file name");
        }
    }));
});

const imageParams: ImageForkInput = { bandPublicId, parentFileId: filePublicId(10), outputType: "jpg", quality: 80,
    editParams: MakeDefaultImageEditParams() };
const galleryParams: GalleryImageInput = { bandPublicId, galleryItemId: galleryPublicId(20),
    imageParams: { parentFileId: imageParams.parentFileId, outputType: imageParams.outputType, quality: 80, editParams: imageParams.editParams } };

describe("BA-S002 image mutation authorization", () => {
    it("requires upload authority at the generic fork resolver boundary", async () => {
        const ctx = seedFileAccess([makeFile()], 40, [Permission.login]);
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findMany");
        await expect(invokeResolver(forkImageMutation, imageParams, ctx)).rejects.toThrow("upload_files");
        expect(lookup).not.toHaveBeenCalled();
    });

    it("checks source visibility before image processing", async () => {
        const ctx = seedFileAccess([makeFile({ visiblePermissionId: permissionId(Permission.visibility_editors) })], 41,
            [Permission.login, Permission.view_files, Permission.upload_files]);
        const read = vi.mocked(filesystem.readFile);
        const auth = await loadAuthorization(ctx.session, bandPublicId);
        await expect(forkImage(fileDatabase, auth, imageParams, "must-not-be-read")).rejects.toThrow("Source image was not found");
        expect(read).not.toHaveBeenCalled();
        expect(authorizationTestDb.snapshot("file")).toHaveLength(1);
    });

    it("uses fresh database grants before looking up a fork source", async () => {
        const ctx = seedFileAccess([makeFile()], 44, [Permission.login, Permission.view_files, Permission.upload_files]);
        const auth = await loadAuthorization(ctx.session, bandPublicId);
        await authorizationTestDb.getDelegate("bandRolePermission").deleteMany({ where: { bandRoleId: 20, permissionId: permissionId(Permission.upload_files) } });
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findMany");
        await expect(forkImage(fileDatabase, auth, imageParams, "must-not-be-read")).rejects.toThrow("upload_files");
        expect(lookup).not.toHaveBeenCalled();
    });

    it("allows an authorized visible source through the pre-filesystem checks", async () => {
        const ctx = seedFileAccess([makeFile()], 46, [Permission.login, Permission.view_files, Permission.upload_files]);
        const read = vi.mocked(filesystem.readFile).mockRejectedValueOnce(new Error("Authorized image reached storage"));
        await expect(forkImage(fileDatabase, await loadAuthorization(ctx.session, bandPublicId), imageParams, "private-fixture"))
            .rejects.toThrow("Authorized image reached storage");
        expect(read).toHaveBeenCalledOnce();
        expect(authorizationTestDb.snapshot("file")).toHaveLength(1);
    });

    it("requires gallery edit authority before target or source lookup", async () => {
        const ctx = seedFileAccess([makeFile()], 42, [Permission.login, Permission.upload_files]);
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("frontpageGalleryItem"), "findMany");
        await expect(invokeResolver(updateGalleryItemImageMutation, galleryParams, ctx)).rejects.toThrow("edit_public_homepage");
        expect(lookup).not.toHaveBeenCalled();
    });

    it("verifies the gallery target before starting a fork", async () => {
        const ctx = seedFileAccess([makeFile()], 43, [Permission.login, Permission.edit_public_homepage, Permission.view_files, Permission.upload_files]);
        const lookup = vi.spyOn(authorizationTestDb.getDelegate("file"), "findMany");
        await expect(updateGalleryItemImage(fileDatabase, await loadAuthorization(ctx.session, bandPublicId), galleryParams, "must-not-be-read")).rejects.toThrow();
        expect(lookup).not.toHaveBeenCalled();
    });

    it("uses fresh database grants before starting a gallery image fork", async () => {
        const ctx = seedFileAccess([makeFile()], 45, [Permission.login, Permission.edit_public_homepage, Permission.view_files, Permission.upload_files]);
        const auth = await loadAuthorization(ctx.session, bandPublicId);
        await authorizationTestDb.getDelegate("bandRolePermission").deleteMany({ where: { bandRoleId: 20, permissionId: permissionId(Permission.edit_public_homepage) } });
        const target = vi.spyOn(authorizationTestDb.getDelegate("frontpageGalleryItem"), "findMany"), source = vi.spyOn(authorizationTestDb.getDelegate("file"), "findMany");
        await expect(updateGalleryItemImage(fileDatabase, auth, galleryParams, "must-not-be-read")).rejects.toThrow("edit_public_homepage");
        expect(target).not.toHaveBeenCalled();
        expect(source).not.toHaveBeenCalled();
    });
});
