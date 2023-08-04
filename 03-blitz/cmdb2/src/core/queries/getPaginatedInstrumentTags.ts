import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";

interface Input__
    extends Pick<
        Prisma.InstrumentTagFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize("getPaginatedInstrumentTags", Permission.view_general_info),
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
                count: () => db.instrumentTag.count({ where }),
                query: (paginateArgs) =>
                    db.instrumentTag.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                        include: {
                            instruments: { include: { instrument: true } }
                        },
                    }),
            });

            return {
                items,
                nextPage,
                hasMore,
                count,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



