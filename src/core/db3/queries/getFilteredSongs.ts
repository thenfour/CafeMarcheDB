import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { QuickSearchItemType } from "shared/quickFilter";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { getQuickSearchResults } from "../server/quickSearchServerCore";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";

interface TArgs {
    autocompleteQuery: string;
};


export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: TArgs, ctx: AuthenticatedCtx): Promise<GetFilteredSongsRet> => {
        try {
            const u = (await getCurrentUserCore(ctx))!;
            if (!u.role || u.role.permissions.length < 1) {
                return { matchingItems: [] };
            }

            const results = await getQuickSearchResults(args.autocompleteQuery, u, [QuickSearchItemType.song]);

            const qr = await db.song.findMany({
                select: GetFilteredSongsItemSongSelect,
                where: {
                    id: { in: results.map(r => r.id) },
                },
            });

            return {
                matchingItems: qr,
            };


        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



