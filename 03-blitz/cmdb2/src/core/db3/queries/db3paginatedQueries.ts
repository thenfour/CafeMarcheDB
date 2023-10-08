import { AuthenticatedMiddlewareCtx, paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import * as db3 from "../db3";
import { CMDBAuthorizeOrThrow } from "types";
import { Permission } from "shared/permissions";
import * as mutationCore from "../server/db3mutationCore"

export default resolver.pipe(
    resolver.authorize("db3paginatedQuery", Permission.login),
    async (input: db3.PaginatedQueryInput, ctx: AuthenticatedMiddlewareCtx) => {
        try {
            const table = db3.gAllTables[input.tableName]!;
            const contextDesc = `paginatedQuery:${table.tableName}`;
            CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);
            const dbTableClient = db[table.tableName]; // the prisma interface

            const orderBy = input.orderBy || table.naturalOrderBy;

            const clientIntention = input.clientIntention;
            if (!input.clientIntention) {
                throw new Error(`client intention is required; context: ${input.cmdbQueryContext}.`);
            }
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            clientIntention.currentUser = currentUser;
            const where = table.CalculateWhereClause({
                clientIntention,
                filterModel: input.filter,
            });

            const include = table.CalculateInclude(clientIntention);

            const {
                items,
                hasMore,
                nextPage,
                count,
            } = await paginate({
                skip: input.skip,
                take: input.take,
                count: () => dbTableClient.count({ where }),
                query: (paginateArgs) =>
                    dbTableClient.findMany({
                        ...paginateArgs,
                        where,
                        orderBy,
                        include,
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





