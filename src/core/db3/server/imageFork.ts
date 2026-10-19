import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { fileImageSourceView, xFile } from "../db3";
import type { FileCustomData } from "../shared/fileTypes";
import { ForkImageParamsSchema, ForkImageResultSchema, type ImageForkInput } from "../shared/imageFork";
import { resolveImageEditGeometry } from "../shared/imageGeometry";
import { bindDB3ReadSnapshot, type DB3ReadContext, type DB3ReadRootDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";
import { authorizeFileCreation, createFileRecord, type FileCreationFields, type FileStorageMetadata } from "./fileCreation";
import { resolveFileStoragePath, withFileStorageRollback } from "./fileStorage";

export class ImageForkInputError extends Error {
    readonly statusCode = 400;
}

async function readImageSource(context: DB3ReadContext, args: ImageForkInput) {
    const result = await queryView({
        view: fileImageSourceView, filter: { publicIds: [args.parentFileId] }, take: 1,
        cmdbQueryContext: "image fork source",
    }, context.authorization, context);
    const source = result.items[0];
    if (!source || typeof source.fileLeafName !== "string" || typeof source.storedLeafName !== "string"
        || source.visiblePermissionId === undefined || source.externalURI !== null
        || !source.mimeType?.startsWith("image/")) {
        throw new ImageForkInputError("Source image was not found.");
    }
    return {
        ...source, fileLeafName: source.fileLeafName, storedLeafName: source.storedLeafName,
        visiblePermissionId: source.visiblePermissionId
    };
}

type ImageSource = Awaited<ReturnType<typeof readImageSource>>;
function forkCreationFields(source: ImageSource, args: ImageForkInput): FileCreationFields {
    return {
        fileLeafName: path.parse(source.fileLeafName).name + "_." + args.outputType,
        description: "", fileCreatedAt: new Date(),
        visiblePermissionId: source.visiblePermissionId, parentFileId: source.publicId,
    };
}

function encodeImage(image: Sharp, args: ImageForkInput): Sharp {
    switch (args.outputType) {
        case "png":
            return image.png({ compressionLevel: 9 });
        case "jpg":
            return image.jpeg({ quality: args.quality });
        case "webp":
            return image.webp({ quality: args.quality });
        case "heic":
            return image.heif({ quality: args.quality, compression: "hevc" });
    }
}

async function transformImage(sourcePath: string, args: ImageForkInput) {
    // Decode EXIF orientation once. Sharp allows only one rotation per pipeline.
    // Buffer input also releases the source handle before Windows storage cleanup.
    const decoded = await sharp(await readFile(sourcePath)).rotate().raw().toBuffer({ resolveWithObject: true });
    const geometry = resolveImageEditGeometry(decoded.info, args.editParams);
    const left = Math.round(geometry.cropBegin.x);
    const top = Math.round(geometry.cropBegin.y);
    // Round edges, rather than sizes, so fractional crops cannot extend a pixel past the image.
    const width = Math.max(1, Math.round(geometry.cropEnd.x) - left);
    const height = Math.max(1, Math.round(geometry.cropEnd.y) - top);
    let image = sharp(decoded.data, { raw: decoded.info }).extract({ left, top, width, height });
    if (args.newDimensions) {
        image = image.resize({
            width: Math.max(1, Math.round(args.newDimensions.width)),
            height: Math.max(1, Math.round(args.newDimensions.height))
        });
    }
    // Forks are physical images; the requested rotation belongs in the output pixels.
    // A separate pipeline ensures that rotation occurs after the crop and resize.
    const cropped = await image.raw().toBuffer({ resolveWithObject: true });
    image = sharp(cropped.data, { raw: cropped.info }).rotate(args.editParams.rotate);
    return encodeImage(image, args).toBuffer({ resolveWithObject: true });
}

async function storeFork(source: ImageSource, args: ImageForkInput, directory: string,
    createdPaths: string[],
): Promise<FileStorageMetadata> {
    const transformed = await transformImage(resolveFileStoragePath(directory, source.storedLeafName), args);
    const storedLeafName = generatePublicId() + "." + args.outputType;
    const outputPath = resolveFileStoragePath(directory, storedLeafName);
    await mkdir(directory, { recursive: true });
    const output = await open(outputPath, "wx");
    createdPaths.push(outputPath);
    try {
        await output.writeFile(new Uint8Array(transformed.data));
    } finally {
        await output.close();
    }
    const customData: FileCustomData = {
        relationToParent: "forkedImage", forkedImage: { creationEditParams: args.editParams },
        imageMetadata: { width: transformed.info.width, height: transformed.info.height },
    };
    const mimeTypes = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", heic: "image/heic" };
    return {
        uploadedAt: new Date(), storedLeafName, mimeType: mimeTypes[args.outputType],
        sizeBytes: transformed.data.length, customData: JSON.stringify(customData)
    };
}

/** Compose an image fork with another write in the caller's authorized snapshot. */
export async function createImageFork(context: DB3ReadContext, input: ImageForkInput,
    storageDirectory: string, createdPaths: string[],
) {
    const args = ForkImageParamsSchema.parse(input);
    const auth = context.authorization.requireUser();
    auth.requirePermission(BandPermission.upload_files);
    if (auth.requireBand().publicId !== args.bandPublicId) {
        throw new AuthorizationError("Image forking requires the selected band.");
    }
    const source = await readImageSource(context, args);
    const fields = forkCreationFields(source, args);
    await authorizeFileCreation(context, fields);
    const metadata = await storeFork(source, args, storageDirectory, createdPaths);
    const file = await createFileRecord(context, fields, metadata);
    return ForkImageResultSchema.parse({ publicId: xFile.parseIdentity(file.publicId) });
}

/** Own the image write and audited File insert together, including a failed transaction commit. */
export async function forkImage(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    input: ImageForkInput, storageDirectory: string,
) {
    return withFileStorageRollback(createdPaths => database.$transaction(async transaction => {
        const context = await bindDB3ReadSnapshot(
            transaction,
            authorization,
            { isolationLevel: "Serializable" }
        );

        return createImageFork(context, input, storageDirectory, createdPaths);

    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 }));
}
