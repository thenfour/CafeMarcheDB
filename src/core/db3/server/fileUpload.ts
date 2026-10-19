import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma, type File } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { constants } from "node:fs";
import { copyFile, mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import mime from "mime";
import sharp from "sharp";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { AutoAssignInstrumentPartition } from "../shared/autoAssignInstrumentPartition";
import { FileUploadArgsSchema, type FileUploadArgs } from "../shared/fileUpload";
import type { FileCustomData, UploadedFile, UploadResponsePayload } from "../shared/fileTypes";
import { fileTagDashboardView, instrumentDashboardView, FileTagSignificance, xFile, xPermission } from "../db3";
import { bindDB3ReadSnapshot, type DB3ReadContext, type DB3ReadRootDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";
import { resolvePublicForeignIds } from "./db3PublicIds";
import { createFileRecord, type FileCreationFields, type FileStorageMetadata } from "./fileCreation";
import { resolveFileStoragePath } from "./fileStorage";
import { createUploadedImagePreview } from "./uploadedImage";

/** Multipart parsing owns these temporary paths; they never come from JSON/client fields. */
export interface FileUploadPart {
    readonly temporaryPath: string;
    readonly originalFilename: string;
    readonly lastModifiedDate: Date | null;
}

export class FileUploadInputError extends Error {
    readonly statusCode = 400;
}

function uploadLeaf(filename: string): string {
    const leaf = filename.split(/[\\/]/).pop() ?? "";
    if (!leaf || leaf.length > 255 || leaf === "." || leaf === "..") {
        throw new FileUploadInputError("Invalid upload filename.");
    }
    return leaf;
}

function uploadAssociations(args: FileUploadArgs) {
    return {
        taggedUsers: args.taggedBandUserId ? [args.taggedBandUserId] : [],
        taggedSongs: args.taggedSongId ? [args.taggedSongId] : [],
        taggedEvents: args.taggedEventId ? [args.taggedEventId] : [],
        taggedInstruments: args.taggedInstrumentId ? [args.taggedInstrumentId] : [],
        taggedWikiPages: args.taggedWikiPageId ? [args.taggedWikiPageId] : [],
        tags: args.fileTagId ? [args.fileTagId] : [],
        visiblePermissionId: args.visiblePermissionId ?? null,
    };
}

async function resolveNamedVisibility(args: FileUploadArgs, context: DB3ReadContext): Promise<FileUploadArgs> {
    if (!args.visiblePermission) {
        return args;
    }
    const permission = await context.database.permission.findUnique({ where: { name: args.visiblePermission }, select: { publicId: true } });
    if (!permission) {
        throw new FileUploadInputError("Unknown visibility permission.");
    }
    return { ...args, visiblePermissionId: xPermission.parseIdentity(permission.publicId) };
}

async function automaticUploadCatalogs(context: DB3ReadContext) {
    const input = { filter: { items: [] }, orderBy: undefined, cmdbQueryContext: "upload auto-assignment" };
    const tags = fileTagDashboardView.entity.authorizeTableForView(context.authorization)
        ? (await queryView({ ...input, view: fileTagDashboardView }, context.authorization, context)).items : [];
    const instruments = instrumentDashboardView.entity.authorizeTableForView(context.authorization)
        ? (await queryView({ ...input, view: instrumentDashboardView }, context.authorization, context)).items : [];
    return { tags, instruments };
}

type UploadCatalogs = Awaited<ReturnType<typeof automaticUploadCatalogs>>;
function assignUploadTags(args: FileUploadArgs, leaf: string, mimeType: string | null, catalogs: UploadCatalogs) {
    const values = uploadAssociations(args);
    const tags = new Set(values.tags);
    const instruments = new Set(values.taggedInstruments);
    const recording = catalogs.tags.find(tag => tag.significance === FileTagSignificance.Recording);
    const partition = catalogs.tags.find(tag => tag.significance === FileTagSignificance.Partition);
    if (mimeType?.startsWith("audio/") && recording) {
        tags.add(recording.publicId);
    }
    if (args.taggedSongId && leaf.toLowerCase().endsWith(".pdf") && partition) {
        tags.add(partition.publicId);
        const matching = AutoAssignInstrumentPartition({
            allInstruments: catalogs.instruments.map(instrument => ({
                publicId: instrument.publicId, autoAssignFileLeafRegex: instrument.autoAssignFileLeafRegex ?? null,
            })),
            fileLeafWithoutExtension: path.parse(leaf).name, getIdentity: instrument => instrument.publicId,
        });
        matching.matchingInstrumentIds.forEach(identity => instruments.add(identity));
    }
    return { ...values, tags: [...tags], taggedInstruments: [...instruments] };
}

async function imageUploadMetadata(storedPath: string, mimeType: string | null): Promise<string | null> {
    if (!mimeType?.startsWith("image/")) {
        return null;
    }
    try {
        const metadata = await sharp(storedPath).metadata();
        const custom: FileCustomData = { imageMetadata: { width: metadata.width, height: metadata.height } };
        return JSON.stringify(custom);
    } catch {
        // Reference uploads accept files whose image metadata cannot be decoded.
        return null;
    }
}

function publicUploadedFile(file: File, authorization: CMServerAuthorization): UploadedFile {
    return { publicId: xFile.parseIdentity(file.publicId), fileLeafName: file.fileLeafName,
        storedLeafName: file.storedLeafName, mimeType: file.mimeType, externalURI: file.externalURI,
        description: file.description, sizeBytes: file.sizeBytes, customData: file.customData,
        uploadedByUserId: authorization.userPublicId,
    };
}

function storageLeaf(leaf: string): string {
    const extension = path.extname(leaf);
    // Storage extensions cannot contain Windows stream syntax or path characters.
    const safeExtension = /^\.[a-z0-9]{1,12}$/i.test(extension) ? extension : "";
    return generatePublicId() + safeExtension;
}

async function createUploadedFile(context: DB3ReadContext, values: FileCreationFields, metadata: FileStorageMetadata): Promise<UploadedFile> {
    const file = await createFileRecord(context, values, metadata);
    return publicUploadedFile(file, context.authorization);
}

async function createExternalUpload(context: DB3ReadContext, args: FileUploadArgs, uri: string): Promise<UploadedFile> {
    const leaf = uploadLeaf(new URL(uri).pathname.split("/").pop() || "(unknown)");
    return createUploadedFile(context, { ...uploadAssociations(args), fileLeafName: leaf,
        description: "", fileCreatedAt: new Date(), externalURI: uri }, {
        uploadedAt: new Date(), storedLeafName: generatePublicId(), mimeType: mime.getType(leaf), sizeBytes: null, customData: null,
    });
}

async function storeLocalUpload(part: FileUploadPart, storageDirectory: string, leaf: string,
    mimeType: string | null, createdPaths: string[],
): Promise<FileStorageMetadata> {
    const storedLeafName = storageLeaf(leaf);
    const storedPath = resolveFileStoragePath(storageDirectory, storedLeafName);
    await mkdir(storageDirectory, { recursive: true });
    await copyFile(part.temporaryPath, storedPath, constants.COPYFILE_EXCL);
    createdPaths.push(storedPath);
    const customData = await imageUploadMetadata(storedPath, mimeType);
    return { uploadedAt: new Date(), storedLeafName, mimeType, sizeBytes: (await stat(storedPath)).size, customData };
}

async function createLocalUploads(context: DB3ReadContext, args: FileUploadArgs, parts: readonly FileUploadPart[],
    storageDirectory: string, createdPaths: string[],
): Promise<UploadedFile[]> {
    const catalogs = await automaticUploadCatalogs(context);
    const uploaded: UploadedFile[] = [];
    for (const part of parts) {
        const leaf = uploadLeaf(part.originalFilename);
        const mimeType = mime.getType(leaf);
        const values = { ...assignUploadTags(args, leaf, mimeType, catalogs), fileLeafName: leaf,
            description: "", fileCreatedAt: part.lastModifiedDate ?? new Date() };
        const metadata = await storeLocalUpload(part, storageDirectory, leaf, mimeType, createdPaths);
        const original = await createFileRecord(context, values, metadata);
        const preview = args.maxImageDimension === undefined ? null
            : await createUploadedImagePreview(context, original, values.visiblePermissionId,
                args.maxImageDimension, storageDirectory, createdPaths);
        uploaded.push(publicUploadedFile(preview ?? original, context.authorization));
    }
    return uploaded;
}

export async function uploadFiles(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    input: FileUploadArgs, parts: readonly FileUploadPart[], storageDirectory: string,
): Promise<UploadResponsePayload> {
    const args = FileUploadArgsSchema.parse(input);
    if (parts.length === 0 && !args.externalURI) {
        throw new FileUploadInputError("Choose files or an external URL.");
    }
    if (parts.length > 0 && args.externalURI) {
        throw new FileUploadInputError("Choose files or an external URL, separately.");
    }
    const createdPaths: string[] = [];
    try {
        return await database.$transaction(async transaction => {
            const auth = (await authorization.refresh(transaction)).requireUser();
            auth.requirePermission(BandPermission.upload_files);
            if (auth.requireBand().publicId !== args.bandPublicId) {
                throw new AuthorizationError("Uploads require the selected band.");
            }
            const context = await bindDB3ReadSnapshot(transaction, auth, { isolationLevel: "Serializable" });
            const values = await resolveNamedVisibility(args, context);
            // Validate supplied parents/catalogs before opening or copying any uploaded file.
            await resolvePublicForeignIds(xFile, uploadAssociations(values), auth, transaction);
            const uploaded = values.externalURI
                ? [await createExternalUpload(context, values, values.externalURI)]
                : await createLocalUploads(context, values, parts, storageDirectory, createdPaths);
            return { files: uploaded, isSuccess: true };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
    } catch (error) {
        await Promise.all(createdPaths.map(createdPath => unlink(createdPath)));
        throw error;
    }
}
