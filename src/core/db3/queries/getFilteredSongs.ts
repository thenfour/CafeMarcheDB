import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xSong, xSongTag, xSongTagAssociation } from "../shared/schema/song";
import type { SongPublicId } from "shared/publicId";
import { xFile } from "../shared/schema/file";

interface TArgs {
    id: SongPublicId | null;
};


export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: TArgs, ctx: AuthenticatedCtx): Promise<GetFilteredSongsRet> => {
        try {
            if (args.id === null) return { matchingItem: null };
            const currentUser = await getCurrentUserCore(ctx);
            if (!currentUser) throw new Error("Current user was not found.");
            const qr = await db.song.findFirst({
                select: GetFilteredSongsItemSongSelect,
                where: await GetAuthorizedTableReadWhere({
                    table: xSong,
                    currentUser,
                    where: { publicId: args.id },
                }),
            });
            if (!qr) return { matchingItem: null };

            return {
                matchingItem: {
                    ...qr,
                    publicId: xSong.parseIdentity(qr.publicId),
                    pinnedRecordingId: qr.pinnedRecording
                        ? xFile.parseIdentity(qr.pinnedRecording.publicId)
                        : null,
                    tags: qr.tags.map(association => ({
                        publicId: xSongTagAssociation.parseIdentity(association.publicId),
                        songId: xSong.parseIdentity(qr.publicId),
                        tagId: xSongTag.parseIdentity(association.tag.publicId),
                    })),
                },
            };


        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



