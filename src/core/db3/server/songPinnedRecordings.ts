import { AuthorizationError } from "blitz";
import { z } from "zod";
import { Permission } from "shared/permissions";
import type { SongPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { xFile, xSong } from "../db3";
import type { TSongPinnedRecording } from "../shared/apiTypes";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { GetAuthorizedTableReadWhere } from "./db3ReadPolicy";

export const SongPinnedRecordingsSchema = z.object({
    bandPublicId: BandPublicIdSchema,
    songIds: z.array(xSong.identitySchema).max(1000),
}).strict();

// Setlist players address this sparse result by the requested public song identity.
export type SongPinnedRecordings = Partial<Record<SongPublicId, TSongPinnedRecording>>;

/** Narrow setlist reader; Song/File page and CRUD roots remain guarded. */
export function readSongPinnedRecordings(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: z.infer<typeof SongPinnedRecordingsSchema>,
): Promise<SongPinnedRecordings> {
    const args = SongPinnedRecordingsSchema.parse(input);
    return executeDB3Read(database, authorization, async ({ database: transaction, authorization: auth }) => {
        if (auth.requireBand().publicId !== args.bandPublicId) {
            throw new AuthorizationError("Recordings require the selected band.");
        }

        // todo: this is redundnat; auth is performed in db3.
        auth.requirePermission(Permission.view_songs);
        if (!args.songIds.length || !auth.hasPermission(Permission.view_files)) {
            return {};
        }

        // Song/File CRUD is still deferred; their legacy tables do not declare band ownership yet.
        const bandId = auth.requireBand().id;
        const fileWhere = await GetAuthorizedTableReadWhere({
            table: xFile,
            auth,
            where: { bandId }
        });

        // TODO: use queryView
        const songs = await transaction.song.findMany({
            where: await GetAuthorizedTableReadWhere({
                table: xSong, auth,
                where: {
                    bandId,
                    publicId: { in: args.songIds },
                    pinnedRecording: fileWhere
                },
            }),
            select: {
                publicId: true, pinnedRecording: {
                    select: {
                        publicId: true,
                        fileLeafName: true,
                        externalURI: true,
                        mimeType: true,
                        sizeBytes: true,
                        fileCreatedAt: true,
                        storedLeafName: true,
                        uploadedAt: true,
                    }
                }
            },
        });
        const result: SongPinnedRecordings = {};
        for (const song of songs) {
            if (song.pinnedRecording) {
                result[xSong.parseIdentity(song.publicId)] = {
                    ...song.pinnedRecording,
                    publicId: xFile.parseIdentity(song.pinnedRecording.publicId),
                };
            }
        }
        return result;
    });
}
