import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";

interface Input__
    extends Pick<
        Prisma.SongFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize("getPaginatedSongs", Permission.view_songs),
    async ({ where, orderBy, skip, take }: Input__, ctx) => {
        try {
            const {
                items,
                hasMore,
                nextPage,
                count,
            } = await paginate({
                skip,
                take,
                count: () => db.song.count({ where }),
                query: (paginateArgs) =>
                    db.song.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                        //include: { roles: { include: { role: true } } },
                    }),
            });

            return {
                items,
                nextPage,
                hasMore,
                count,
            };
        } catch (e) {
            console.error(`Exception while getPaginatedSongs`);
            console.error(e);
            throw (e);
        }
    }
);



