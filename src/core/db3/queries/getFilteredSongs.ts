import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { SplitQuickFilter } from "shared/utils";
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

            const tokens = SplitQuickFilter(args.autocompleteQuery);
            // any tokens starting with "#" are tags
            const songTokens = tokens.filter(t => !t.startsWith("#") && (t.length > 1));

            const songFilterAnded: Prisma.SongWhereInput[] = songTokens.map((t): Prisma.SongWhereInput => ({
                OR: [
                    { name: { contains: t, } },
                    { aliases: { contains: t, } }
                ]
            }));

            const tagTokens = tokens.filter(t => t.startsWith("#")).map(t => t.substring(1));
            tagTokens.forEach(t => {
                songFilterAnded.push({ tags: { some: { tag: { text: { contains: t } } } } });
            });

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
                        ...songFilterAnded,
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



