import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { TSongPinnedRecording } from "../shared/apiTypes";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xFile } from "../shared/schema/file";
import { xSong } from "../shared/schema/song";
import type { SongPublicId } from "shared/publicId";

const ZArgs = z.object({
    songIds: z.array(xSong.identitySchema),
});

export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx): Promise<Partial<Record<SongPublicId, TSongPinnedRecording>>> => {
        try {
            const currentUser = await getCurrentUserCore(ctx);
            if (!currentUser) throw new Error("Current user was not found.");
            const fileWhere = await GetAuthorizedTableReadWhere({
                table: xFile,
                currentUser,
            });
            const qr = await db.song.findMany({
                where: await GetAuthorizedTableReadWhere({
                    table: xSong,
                    currentUser,
                    where: {
                        publicId: { in: args.songIds },
                        pinnedRecordingId: { not: null },
                        pinnedRecording: fileWhere,
                    },
                }),
                select: {
                    publicId: true,
                    pinnedRecording: {
                        select: {
                            publicId: true,
                            fileLeafName: true,
                            externalURI: true,
                            mimeType: true,
                            sizeBytes: true,
                            fileCreatedAt: true,
                            storedLeafName: true,
                            uploadedAt: true,
                        },
                    },
                },
            });

            // Create a map of songId -> pinnedRecording for easy lookup
            const result: Partial<Record<SongPublicId, TSongPinnedRecording>> = {};
            qr.forEach(song => {
                if (song.pinnedRecording) {
                    result[xSong.parseIdentity(song.publicId)] = {
                        ...song.pinnedRecording,
                        publicId: xFile.parseIdentity(song.pinnedRecording.publicId),
                    };
                }
            });

            return result;

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



