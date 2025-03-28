import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { QuickSearchItemType } from "shared/quickFilter";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { getQuickSearchResults } from "../server/quickSearchServerCore";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";
import { toSorted } from "shared/arrayUtils";

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

            let results = await getQuickSearchResults(args.autocompleteQuery, u, [QuickSearchItemType.song]);

            const qr = await db.song.findMany({
                select: GetFilteredSongsItemSongSelect,
                where: {
                    id: { in: results.map(r => r.id) },
                },
            });

            const sorted = toSorted(qr, (a, b) => {
                const aMatchStrength = results.find(r => r.id === a.id)?.matchStrength || 0;
                const bMatchStrength = results.find(r => r.id === b.id)?.matchStrength || 0;
                return bMatchStrength - aMatchStrength;
            });

            return {
                matchingItems: sorted,
            };


        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



