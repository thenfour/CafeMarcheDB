import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { Permission } from "shared/permissions";
import * as authorization from "src/auth/server/serverAuthorization";
import updateGalleryItemImage from "src/core/db3/mutations/updateGalleryItemImage";
import * as gallery from "src/core/db3/server/galleryImage";
import * as storage from "src/core/db3/server/fileStorage";
import { UpdateGalleryItemImageParamsSchema } from "src/core/db3/shared/galleryImage";
import { MakeDefaultImageEditParams } from "src/core/db3/shared/fileTypes";
import { applyGalleryImageDrag } from "src/core/db3/shared/galleryImageEditor";
import { SharedAPI } from "src/core/db3/shared/sharedAPI";
import { createAuthorizationPersona, createAuthorizationTestContext } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";

const input = { bandPublicId: parsePublicId<"Band">("GalleryBand00001"), galleryItemId: parsePublicId<"FrontpageGalleryItem">("GalleryItem00001"),
    imageParams: { parentFileId: parsePublicId<"File">("GalleryImage0001"), outputType: "png", quality: 80, editParams: MakeDefaultImageEditParams() } };

describe("gallery bake RPC and strict input", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it("requires one explicit band and rejects forged gallery/image metadata", () => {
        expect(UpdateGalleryItemImageParamsSchema.parse(input)).toEqual(input);
        for (const patch of [{ bandPublicId: undefined }, { galleryItemId: 1 }, { bandId: 1 },
            { imageParams: { ...input.imageParams, bandPublicId: input.bandPublicId } },
            { imageParams: { ...input.imageParams, storedLeafName: "forged" } }]) {
            expect(() => UpdateGalleryItemImageParamsSchema.parse({ ...input, ...patch })).toThrow();
        }
    });
    it("loads the selected band and invokes only the validated atomic owner", async () => {
        const persona = createAuthorizationPersona("normal", { permissions: [Permission.login, Permission.upload_files, Permission.edit_public_homepage] });
        const load = vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(persona.schemaAuthorization);
        vi.spyOn(storage, "requireFileStorageDirectory").mockReturnValue("private-gallery");
        const bake = vi.spyOn(gallery, "updateGalleryItemImage").mockResolvedValue({
            newFile: { publicId: input.imageParams.parentFileId }, newDisplayParams: MakeDefaultImageEditParams() });
        await invokeResolver(updateGalleryItemImage, input, persona.ctx);
        expect(load.mock.calls[0]?.[1]).toBe(input.bandPublicId);
        expect(bake.mock.calls[0]?.[1]).toBe(persona.schemaAuthorization);
        expect(bake.mock.calls[0]?.[2]).toEqual(input); expect(bake.mock.calls[0]?.[3]).toBe("private-gallery");
    });
    it.each([Permission.edit_public_homepage, Permission.upload_files])("checks %s before storage configuration", async permission => {
        const persona = createAuthorizationPersona("normal", { permissions: [Permission.login, Permission.upload_files, Permission.edit_public_homepage].filter(value => value !== permission) });
        vi.spyOn(authorization, "loadAuthorization").mockResolvedValue(persona.schemaAuthorization);
        const configure = vi.spyOn(storage, "requireFileStorageDirectory");
        const bake = vi.spyOn(gallery, "updateGalleryItemImage");
        await expect(invokeResolver(updateGalleryItemImage, input, persona.ctx)).rejects.toThrow(permission);
        expect(configure).not.toHaveBeenCalled(); expect(bake).not.toHaveBeenCalled();
    });
    it("requires login before parsing or querying a target", async () => {
        const load = vi.spyOn(authorization, "loadAuthorization");
        await expect(invokeResolver(updateGalleryItemImage, {}, createAuthorizationTestContext(null))).rejects.toThrow("login");
        expect(load).not.toHaveBeenCalled();
    });
});

describe("reference image joystick behavior", () => {
    it("moves and crops around the authored bounds without mutating the draft", () => {
        const params = { cropBegin: { x: 10, y: 20 }, cropSize: { width: 100, height: 50 }, rotate: 5 };
        const size = { width: 200, height: 100 }, delta = { x: 3, y: 2 };
        expect(applyGalleryImageDrag(size, params, "Move", delta).cropBegin).toEqual({ x: 7, y: 18 });
        expect(applyGalleryImageDrag(size, params, "CropBegin", delta)).toMatchObject({ cropBegin: { x: 13, y: 22 }, cropSize: { width: 97, height: 48 } });
        expect(applyGalleryImageDrag(size, params, "CropEnd", delta).cropSize).toEqual({ width: 103, height: 52 });
        expect(applyGalleryImageDrag(size, params, "Rotate", delta).rotate).toBe(5.02);
        expect(params.cropSize.width).toBe(100);
    });
    it("centers scaling on the resolved crop and safely resumes cropping after Reset", () => {
        const size = { width: 200, height: 100 };
        const params = { cropBegin: { x: 10, y: 20 }, cropSize: { width: 100, height: 50 }, rotate: 0 };
        expect(applyGalleryImageDrag(size, params, "Scale", { x: 50, y: 50 })).toMatchObject({
            cropBegin: { x: 20, y: 25 }, cropSize: { width: 80, height: 40 } });
        expect(applyGalleryImageDrag(size, MakeDefaultImageEditParams(), "CropEnd", { x: -10, y: -20 }).cropSize).toEqual({ width: 190, height: 80 });
        expect(applyGalleryImageDrag(size, params, "CropBegin", { x: 1000, y: 1000 }).cropSize).toEqual({ width: 1, height: 1 });
    });
    it("uses the supplied contextual image URL in the existing homepage preview", () => {
        const imageFileUri = "/api/files/download/image.png?bandPublicId=" + input.bandPublicId;
        const info = SharedAPI.files.getPublicGalleryImageInfo({ galleryItemId: input.galleryItemId,
            fileId: input.imageParams.parentFileId, caption: "", sortOrder: 0, imageFileUri, storedLeafName: "image.png",
            mimeType: "image/png", customData: JSON.stringify({ imageMetadata: { width: 200, height: 100 } }),
            displayParams: JSON.stringify(MakeDefaultImageEditParams()), editParams: MakeDefaultImageEditParams() });
        expect(info.imageURI).toBe(imageFileUri); expect(info.cropSize).toEqual({ width: 200, height: 100 });
    });
});
