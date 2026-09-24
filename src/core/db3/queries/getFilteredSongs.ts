import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xSong } from "../shared/schema/song";
import { parsePublicId } from "shared/publicId";

interface TArgs {
    id: number;
};


export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: TArgs, ctx: AuthenticatedCtx): Promise<GetFilteredSongsRet> => {
        try {
            const currentUser = await getCurrentUserCore(ctx);
            if (!currentUser) throw new Error("Current user was not found.");
            const qr = await db.song.findFirst({
                select: GetFilteredSongsItemSongSelect,
                where: await GetAuthorizedTableReadWhere({
                    table: xSong,
                    currentUser,
                    where: { id: args.id },
                }),
            });
            if (!qr) return { matchingItem: null };

            return {
                matchingItem: {
                    ...qr,
                    tags: qr.tags.map(association => ({
                        publicId: parsePublicId<"SongTagAssociation">(association.publicId),
                        songId: association.songId,
                        tagId: parsePublicId<"SongTag">(association.tag.publicId),
                    })),
                },
            };


        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



