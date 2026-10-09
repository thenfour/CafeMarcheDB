import { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { z } from "zod";
import { Permission } from "shared/permissions";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { songEditorView, xFile, xSong } from "../db3";
import type { DB3ReadRootDatabase } from "./db3ReadExecution";
import { createCommandRowServices } from "./db3CommandCore";

export const UpdateSongBasicFieldsSchema = z.object({
    bandPublicId: BandPublicIdSchema,
    songId: xSong.identitySchema,
    description: z.string().optional(),
}).strict();
export const UpdateSongPinnedRecordingSchema = z.object({
    bandPublicId: BandPublicIdSchema,
    songId: xSong.identitySchema,
    fileId: xFile.identitySchema.nullable(),
}).strict();

function writeSongFields(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    target: { bandPublicId: z.infer<typeof BandPublicIdSchema>; songId: z.infer<typeof xSong.identitySchema> },
    fields: { description?: string; pinnedRecordingId?: z.infer<typeof xFile.identitySchema> | null },
    permission: Permission,
) {
    const dto = songEditorView.crud.operations.update.command.parseDto({ identity: target.songId, patch: fields });
    return database.$transaction(async transaction => {
        const auth = (await authorization.refresh(transaction)).requireUser();
        if (auth.requireBand().publicId !== target.bandPublicId) {
            throw new AuthorizationError("Song editing requires the selected band.");
        }
        auth.requirePermission(permission);
        await createCommandRowServices(auth, transaction).update(xSong, dto.identity, dto.patch);
        return { songId: target.songId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
}

export function updateSongBasicFields(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    input: z.infer<typeof UpdateSongBasicFieldsSchema>,
) {
    const { description, ...target } = UpdateSongBasicFieldsSchema.parse(input);
    return writeSongFields(database, authorization, target, description === undefined ? {} : { description }, Permission.view_songs);
}

export function updateSongPinnedRecording(database: DB3ReadRootDatabase, authorization: CMServerAuthorization,
    input: z.infer<typeof UpdateSongPinnedRecordingSchema>,
) {
    const { fileId, ...target } = UpdateSongPinnedRecordingSchema.parse(input);
    return writeSongFields(database, authorization, target, { pinnedRecordingId: fileId }, Permission.pin_song_recordings);
}
