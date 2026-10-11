import type { File } from "@prisma/client";
import { AuthorizationError } from "blitz";
import type { BandUserPublicId, EventPublicId, FilePublicId, FileTagPublicId, InstrumentPublicId, PermissionPublicId, SongPublicId, WikiPagePublicId } from "shared/publicId";
import { xFile } from "../db3";
import type { DB3ReadContext } from "./db3ReadExecution";
import { resolvePublicForeignIds } from "./db3PublicIds";
import { insertImpl, requireAuthorizedMutationFields } from "./db3mutationCore";

export interface FileCreationFields {
    readonly fileLeafName: string;
    readonly description: string;
    readonly fileCreatedAt: Date | null;
    readonly visiblePermissionId: PermissionPublicId | null;
    readonly externalURI?: string;
    readonly parentFileId?: FilePublicId;
    readonly previewFileId?: FilePublicId;
    readonly tags?: readonly FileTagPublicId[];
    readonly taggedUsers?: readonly BandUserPublicId[];
    readonly taggedSongs?: readonly SongPublicId[];
    readonly taggedEvents?: readonly EventPublicId[];
    readonly taggedInstruments?: readonly InstrumentPublicId[];
    readonly taggedWikiPages?: readonly WikiPagePublicId[];
}

export type FileStorageMetadata = Pick<File, "uploadedAt" | "storedLeafName" | "mimeType" | "sizeBytes" | "customData">;

/** Preflight and persistence share the File declaration's field/row policy. */
export async function authorizeFileCreation(context: DB3ReadContext, values: FileCreationFields): Promise<void> {
    const fields = await resolvePublicForeignIds(xFile, values, context.authorization, context.database);
    requireAuthorizedMutationFields(xFile, xFile.authorizeAndSanitize({
        contextDesc: "File creation preflight", model: fields, auth: context.authorization,
        rowMode: "new", fallbackOwnerId: null,
    }));
}

export async function createFileRecord(context: DB3ReadContext, values: FileCreationFields, metadata: FileStorageMetadata): Promise<File> {
    const fields = await resolvePublicForeignIds(xFile, values, context.authorization, context.database);
    return insertImpl<File>(xFile, fields, context.authorization, context.database, { serverOwnedFields: metadata });
}

function requireUploadedParent(context: DB3ReadContext, parent: File): void {
    const auth = context.authorization.requireUser();
    if (parent.bandId !== auth.requireBand().id || parent.uploadedByUserId !== auth.userId
        || parent.isDeleted || parent.externalURI !== null) {
        throw new AuthorizationError("An upload child requires its own active local parent.");
    }
}

export async function authorizeUploadedFileChild(context: DB3ReadContext, parent: File,
    values: Omit<FileCreationFields, "parentFileId">,
): Promise<void> {
    requireUploadedParent(context, parent);
    await authorizeFileCreation(context, values);
}

/** Uploads already own their new parent in this transaction; no client can supply this File. */
export async function createUploadedFileChild(context: DB3ReadContext, parent: File,
    values: Omit<FileCreationFields, "parentFileId">, metadata: FileStorageMetadata,
): Promise<File> {
    requireUploadedParent(context, parent);
    const auth = context.authorization;
    const fields = await resolvePublicForeignIds(xFile, values, auth, context.database);
    // The server-created parent is trusted here. Client-selected parents still use public-ID read policy.
    return insertImpl<File>(xFile, { ...fields, parentFileId: parent.id }, auth, context.database,
        { serverOwnedFields: metadata });
}
