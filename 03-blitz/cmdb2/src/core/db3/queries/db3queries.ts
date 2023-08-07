import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";

export default resolver.pipe(
    resolver.authorize(),
    async (input: db3.QueryInput<unknown, unknown>, ctx: AuthenticatedMiddlewareCtx) => {
        try {
            const table = db3.gAllTables[input.tableName]!;
            const contextDesc = `query:${table.tableName}`;
            CMDBAuthorizeOrThrow(contextDesc, table.queryPermission, ctx);
            const dbTableClient = db[table.tableName]; // the prisma interface

            const items = await dbTableClient.findMany({
                where: input.where,
                orderBy: input.orderBy,
                include: table.localInclude
            });
            return items;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



