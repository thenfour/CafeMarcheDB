import { cmauthorize } from "@/src/auth/server/cmResolver";
import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import type { SongPublicId } from "shared/publicId";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";
import { xFile } from "../shared/schema/file";
import { xSong, xSongTag, xSongTagAssociation } from "../shared/schema/song";

interface TArgs {
    id: SongPublicId | null;
};


export default resolver.pipe(
    cmauthorize(Permission.view_songs),
    async (args: TArgs, ctx): Promise<GetFilteredSongsRet> => {
        try {
            if (args.id === null) return { matchingItem: null };
            //const currentUser = (await loadAuthorization(ctx.session)).user;
            const currentUser = ctx.auth.user;

            if (!currentUser) throw new Error("Current user was not found.");
            const qr = await db.song.findFirst({
                select: GetFilteredSongsItemSongSelect,
                where: await GetAuthorizedTableReadWhere({
                    table: xSong,
                    auth: ctx.auth,
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



