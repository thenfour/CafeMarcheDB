import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { GetFilteredSongsArgsSchema, GetFilteredSongsItemSongSelect, type GetFilteredSongsArgs, type GetFilteredSongsRet } from "../shared/apiTypes";
import { GetUserVisibilityWhereExpression } from "./db3Helpers";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";

type SelectedSong = Prisma.SongGetPayload<{ select: typeof GetFilteredSongsItemSongSelect }>;

function requireSetlistSongBand(auth: CMServerAuthorization, args: GetFilteredSongsArgs): number {
    auth.requireUser();
    const band = auth.requireBand();
    if (band.publicId !== args.bandPublicId) {
        throw new AuthorizationError("Song lookup requires the selected band.");
    }
    auth.requirePermission(Permission.view_songs);
    return band.id;
}

function visiblePinnedRecording(file: SelectedSong["pinnedRecording"], auth: CMServerAuthorization): boolean {
    if (!file || file.bandId !== auth.requireBand().id || file.isDeleted || !auth.hasPermission(Permission.view_files)) {
        return false;
    }
    return file.visiblePermissionId === null
        ? file.uploadedByUserId === auth.userId
        : auth.effectivePermissions.includesId(file.visiblePermissionId);
}

function projectSetlistSong(song: SelectedSong, auth: CMServerAuthorization): GetFilteredSongsRet {
    const { publicId, tags, pinnedRecording, ...details } = song;
    const songId = parsePublicId<"Song">(publicId);
    return {
        matchingItem: {
            ...details,
            publicId: songId,
            pinnedRecordingId: visiblePinnedRecording(pinnedRecording, auth) && pinnedRecording
                ? parsePublicId<"File">(pinnedRecording.publicId)
                : null,
            tags: tags.map(association => ({
                publicId: parsePublicId<"SongTagAssociation">(association.publicId), songId,
                bandSongTagId: parsePublicId<"SongTag">(association.tag.publicId),
            })),
        }
    };
}

/** A narrow lookup for setlist cards; generic Song/File CRUD remains guarded. */
export function readSetlistSong(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: GetFilteredSongsArgs,
): Promise<GetFilteredSongsRet> {
    const args = GetFilteredSongsArgsSchema.parse(input);
    return executeDB3Read(database, authorization, async ({ database: tx, authorization: auth }) => {
        const bandId = requireSetlistSongBand(auth, args);
        if (args.id === null) {
            return { matchingItem: null };
        }
        const song = await tx.song.findFirst({
            where: {
                publicId: args.id,
                bandId,
                // lsmb todo: this is likely redundant with GetUserVisibilityWhereExpression; this
                // function should not attempt to implement song entity behaviors.
                isDeleted: false,
                ...GetUserVisibilityWhereExpression({ auth, createdByUserIDColumnName: "createdByUserId" }),
            },
            select: {
                ...GetFilteredSongsItemSongSelect,
                tags: {
                    ...GetFilteredSongsItemSongSelect.tags,
                    where: {
                        tag: {
                            bandId,
                            isHidden: false
                        }
                    },
                    orderBy: { publicId: "asc" },
                },
            },
        });
        return song ? projectSetlistSong(song, auth) : { matchingItem: null };
    });
}
