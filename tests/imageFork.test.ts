import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { ForkImageParamsSchema } from "src/core/db3/shared/imageFork";
import { resolveImageEditGeometry } from "src/core/db3/shared/imageGeometry";
import { SharedAPI } from "src/core/db3/shared/sharedAPI";
import { resolveFileStoragePath } from "src/core/db3/server/fileStorage";

const request = {
    bandPublicId: parsePublicId<"Band">("ImageForkBand001"),
    parentFileId: parsePublicId<"File">("ImageForkFile001"),
    outputType: "png", quality: 80,
    editParams: { cropBegin: { x: 0, y: 0 }, cropSize: null, rotate: 0 },
};

describe("image fork request contract", () => {
    it("requires explicit public band/source IDs and accepts the reference formats", () => {
        for (const outputType of ["png", "jpg", "webp", "heic"]) {
            expect(ForkImageParamsSchema.parse({ ...request, outputType }).outputType).toBe(outputType);
        }
        for (const patch of [{ bandPublicId: undefined }, { bandPublicId: 1 }, { parentFileId: 1 },
            { outputType: "constructor" }, { outputType: "gif" }, { quality: 0 }, { quality: 101 },
            { quality: 2.5 }, { storedLeafName: "forged" }, { uploadedByUserId: "forged" },
            { tags: ["forged"] }, { newDimensions: { width: 0, height: 10 } },
            { newDimensions: { width: 16_385, height: 10 } }]) {
            expect(() => ForkImageParamsSchema.parse({ ...request, ...patch })).toThrow();
        }
    });

    it.each([NaN, Infinity, -Infinity])("rejects nonfinite coordinates/angles/sizes: %s", value => {
        for (const editParams of [
            { ...request.editParams, rotate: value },
            { ...request.editParams, cropBegin: { x: value, y: 0 } },
            { ...request.editParams, cropSize: { width: value, height: 10 } },
        ]) {
            expect(() => ForkImageParamsSchema.parse({ ...request, editParams })).toThrow();
        }
    });

    it.each(["../secret", "..\\secret", "image.png:stream", ".", "..", ""])("rejects unsafe storage leaves: %s", leaf => {
        expect(() => resolveFileStoragePath("C:/private/image-fixture", leaf)).toThrow("Invalid stored file name");
    });
});

describe("shared image crop geometry", () => {
    it("preserves the reference intersection, masks and rotation around the crop center", () => {
        const params = { cropBegin: { x: -5, y: 15 }, cropSize: { width: 30, height: 30 }, rotate: 45 };
        const geometry = resolveImageEditGeometry({ width: 100, height: 40 }, params);
        expect(geometry).toMatchObject({
            cropBegin: { x: 0, y: 15 }, cropSize: { width: 25, height: 25 },
            cropEnd: { x: 25, y: 40 }, cropCenter: { x: 12.5, y: 27.5 }, rotate: 45,
            maskTopHeight: 15, maskBottomHeight: 0, maskLeftWidth: 0, maskRightWidth: 75,
        });
        const preview = SharedAPI.files.getImageFileEditInfo({
            storedLeafName: "image.png", mimeType: "image/png",
            customData: JSON.stringify({ imageMetadata: { width: 100, height: 40 } }),
        }, params);
        expect(preview).toEqual({ imageURI: "/api/files/download/image.png", ...geometry });
        expect(params.cropBegin.x).toBe(-5);
        expect(params.cropSize.width).toBe(30);
    });

    it("fits minimum crops to tiny images and clamps begins beyond the end", () => {
        expect(resolveImageEditGeometry({ width: 4, height: 3 }, request.editParams)).toMatchObject({
            cropBegin: { x: 0, y: 0 }, cropSize: { width: 4, height: 3 },
        });
        expect(resolveImageEditGeometry({ width: 30, height: 20 }, {
            cropBegin: { x: 100, y: 100 }, cropSize: { width: 2, height: 2 }, rotate: 0,
        })).toMatchObject({ cropBegin: { x: 20, y: 10 }, cropSize: { width: 10, height: 10 } });
    });
});
