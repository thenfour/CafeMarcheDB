import { AuthenticatedMiddlewareCtx, paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma, PrismaClient } from "db";
import { Permission } from "shared/permissions";

interface FindManyBase { where?: any, orderBy?: any, skip?: any, take?: any }

interface QueryInput<FindManyArgs extends FindManyBase> {
    operation: "paginate" | "all";
    data: Pick<FindManyArgs, "where" | "orderBy" | "skip" | "take">;
};

interface PaginatedQueryArgs<Ttable extends TableBase, Tinclude> {
    ctx: AuthenticatedMiddlewareCtx;
    table: Ttable;
    include: Tinclude;
};

interface TableBase {
    count: any;
    findMany: any;
};

// a pagination query returns a richer object, not just an array of items.
const doPaginatedQuery = async <Ttable extends TableBase, TfindManyArgs extends FindManyBase, Tinclude,>(input: QueryInput<TfindManyArgs>, args: PaginatedQueryArgs<Ttable, Tinclude>) => {
    const {
        items,
        hasMore,
        nextPage,
        count,
    } = await paginate({
        skip: input.data.skip,
        take: input.data.take,
        count: () => args.table.count({ where: input.data.where }),
        query: (paginateArgs) =>
            args.table.findMany({
                ...paginateArgs,
                where: input.data.where,
                orderBy: input.data.orderBy,
                include: args.include,
            }),
    });

    return {
        items,
        nextPage,
        hasMore,
        count,
    };
};

// a pagination query returns a richer object, not just an array of items.
const doAllItemsQuery = async <Ttable extends TableBase, TfindManyArgs extends FindManyBase, Tinclude,>(input: QueryInput<TfindManyArgs>, args: PaginatedQueryArgs<Ttable, Tinclude>) => {
    try {
        const items = await args.table.findMany({
            ...input.data, // skip, orderBy, where, take goes here.
            include: args.include,
        });
        return items;
    } catch (e) {
        console.error(e);
        throw (e);
    }
};

export default resolver.pipe(
    resolver.authorize("getInstrumentFunctionalGroups", Permission.view_general_info),
    async (input: QueryInput<Prisma.InstrumentFunctionalGroupFindManyArgs>, ctx) => {
        try {
            if (input.operation === "paginate") {
                return await doPaginatedQuery<
                    typeof db.instrumentFunctionalGroup,
                    Prisma.InstrumentFunctionalGroupFindManyArgs,
                    Prisma.InstrumentFunctionalGroupInclude>(input, {
                        ctx,
                        table: db.instrumentFunctionalGroup,
                        include: {
                            instruments: true,
                        }
                    });
            } else if (input.operation === "all") {
                return await doAllItemsQuery<
                    typeof db.instrumentFunctionalGroup,
                    Prisma.InstrumentFunctionalGroupFindManyArgs,
                    Prisma.InstrumentFunctionalGroupInclude>(input, {
                        ctx,
                        table: db.instrumentFunctionalGroup,
                        include: {
                            instruments: true,
                        }
                    });
            }

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



