import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "../server/db3mutationCore";
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

            const qr = await db.song.findMany({
                select: GetFilteredSongsItemSongSelect,
                where: {
                    AND: [
                        {
                            isDeleted: false,
                        },
                        {
                            // don't show any private items; they're not useful in song lists anyway.
                            visiblePermissionId: { not: null }
                        },
                        {
                            OR: [
                                { name: { contains: args.autocompleteQuery, } },
                                { aliases: { contains: args.autocompleteQuery, } },
                            ]
                        },
                    ]
                },
                take: 10,
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



