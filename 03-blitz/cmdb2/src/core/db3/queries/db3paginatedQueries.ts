import { AuthenticatedMiddlewareCtx, paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import * as db3 from "../db3";
import { CMDBAuthorizeOrThrow } from "types";
import { Permission } from "shared/permissions";

export default resolver.pipe(
    resolver.authorize("db3paginatedQuery", Permission.login),
    async (input: db3.PaginatedQueryInput, ctx: AuthenticatedMiddlewareCtx) => {
        try {
            const table = db3.gAllTables[input.tableName]!;
            const contextDesc = `paginatedQuery:${table.tableName}`;
            CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);
            const dbTableClient = db[table.tableName]; // the prisma interface

            const {
                items,
                hasMore,
                nextPage,
                count,
            } = await paginate({
                skip: input.skip,
                take: input.take,
                count: () => dbTableClient.count({ where: input.where }),
                query: (paginateArgs) =>
                    dbTableClient.findMany({
                        ...paginateArgs,
                        where: input.where,
                        orderBy: input.orderBy,
                        include: table.localInclude || undefined,
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





