import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";

export default resolver.pipe(
    resolver.authorize("db3query", Permission.login),
    async (input: db3.QueryInput, ctx: AuthenticatedMiddlewareCtx) => {
        try {
            //debugger;
            const table = db3.gAllTables[input.tableName]!;
            console.assert(!!table);
            const contextDesc = `query:${table.tableName}`;
            CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);
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



