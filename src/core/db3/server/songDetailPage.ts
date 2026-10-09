import { Permission } from "shared/permissions";
import type { SongPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { songDetailView } from "../db3";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";
import { DB3PublicIdError } from "./db3PublicIds";

export function readSongDetailPage(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: PresentationInput, songId: SongPublicId,
): Promise<{ title: string; songId: SongPublicId } | null> {
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization;
        if (!auth.user || !auth.hasPermission(Permission.view_songs) || !input.bandPublicId
            || auth.band?.publicId !== input.bandPublicId) {
            return null;
        }
        const result = await queryView({ view: songDetailView, ...input,
            filter: { tableParams: { songId } }, take: 1, cmdbQueryContext: "song detail page",
        }, auth, context).catch(error => {
            if (error instanceof DB3PublicIdError) {
                return null;
            }
            throw error;
        });
        const song = result?.items[0];
        return song ? { title: song.name ?? "", songId: song.publicId } : null;
    });
}
