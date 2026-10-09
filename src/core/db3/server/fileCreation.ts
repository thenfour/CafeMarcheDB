import type { File } from "@prisma/client";
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
