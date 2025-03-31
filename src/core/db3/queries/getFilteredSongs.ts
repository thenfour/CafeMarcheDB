import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";

interface TArgs {
    id: number;
};


export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: TArgs, ctx: AuthenticatedCtx): Promise<GetFilteredSongsRet> => {
        try {
            const qr = await db.song.findUnique({
                select: GetFilteredSongsItemSongSelect,
                where: { id: args.id },
            });
            if (!qr) return { matchingItem: null };

            return {
                matchingItem: qr,
            };


        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



