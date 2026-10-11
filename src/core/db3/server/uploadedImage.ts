import type { File } from "@prisma/client";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OutputInfo, type Sharp } from "sharp";
import type { PermissionPublicId } from "shared/publicId";
import { generatePublicId } from "src/server/publicId";
import type { FileCustomData } from "../shared/fileTypes";
import type { DB3ReadContext } from "./db3ReadExecution";
import { authorizeUploadedFileChild, createUploadedFileChild, type FileStorageMetadata } from "./fileCreation";
import { resolveFileStoragePath } from "./fileStorage";

async function loadOversizedImage(parent: File, maximumDimension: number, directory: string): Promise<Sharp | null> {
    if (!parent.mimeType?.startsWith("image/")) {
        return null;
    }
    const bytes = await readFile(resolveFileStoragePath(directory, parent.storedLeafName));
    const image = sharp(bytes);
    const dimensions = await image.metadata();
    // Preserve the reference boundary: a long, narrow image keeps its original bytes and identity.
    if (!dimensions.width || !dimensions.height
        || dimensions.width <= maximumDimension || dimensions.height <= maximumDimension) {
        return null;
    }
    return image;
}

async function storeImagePreview(directory: string, resized: { data: Buffer; info: OutputInfo },
    createdPaths: string[],
): Promise<FileStorageMetadata> {
    const storedLeafName = generatePublicId() + ".jpg";
    const outputPath = resolveFileStoragePath(directory, storedLeafName);
    const output = await open(outputPath, "wx");
    createdPaths.push(outputPath);
    try {
        await output.writeFile(new Uint8Array(resized.data));
    } finally {
        await output.close();
    }
    const custom: FileCustomData = { relationToParent: "forkedImage",
        imageMetadata: { width: resized.info.width, height: resized.info.height } };
    return {
        uploadedAt: new Date(), storedLeafName, mimeType: "image/jpeg",
        sizeBytes: resized.data.length, customData: JSON.stringify(custom),
    };
}

/** Keep the original upload and return the reference JPEG child only when both edges exceed the limit. */
export async function createUploadedImagePreview(context: DB3ReadContext, parent: File,
    visiblePermissionId: PermissionPublicId | null, maximumDimension: number,
    directory: string, createdPaths: string[],
): Promise<File | null> {
    const values = { fileLeafName: path.parse(parent.fileLeafName).name + "_.jpg",
        description: "", fileCreatedAt: new Date(), visiblePermissionId };
    await authorizeUploadedFileChild(context, parent, values);
    const image = await loadOversizedImage(parent, maximumDimension, directory);
    if (!image) {
        return null;
    }
    const resized = await image.rotate().resize({ width: maximumDimension, height: maximumDimension, fit: "inside" })
        .jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const metadata = await storeImagePreview(directory, resized, createdPaths);
    return createUploadedFileChild(context, parent, values, metadata);
}
