import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";

interface Input__
    extends Pick<
        Prisma.InstrumentFindManyArgs,
        "where" | "orderBy" | "skip" | "take"
    > { }

export default resolver.pipe(
    resolver.authorize("getPaginatedInstruments", Permission.view_general_info),
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
                count: () => db.instrument.count({ where }),
                query: (paginateArgs) =>
                    db.instrument.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                        include: {
                            functionalGroup: true,
                            instrumentTags: { include: { tag: true } }
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
            console.error(`Exception while getPaginatedInstruments`);
            console.error(e);
            throw (e);
        }
    }
);



