import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { AuthenticatedMiddlewareCtx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";
import * as mutationCore from "../server/db3mutationCore"

export default resolver.pipe(
    resolver.authorize("db3query", Permission.login),
    async (input: db3.QueryInput, ctx: AuthenticatedMiddlewareCtx) => {
        try {
            const table = db3.gAllTables[input.tableID]!;
            console.assert(!!table);
            const contextDesc = `query:${table.tableName}`;
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

            const items = await dbTableClient.findMany({
                where,
                orderBy,
                include,
                take: input.take,
            });
            return {
                items,
                where,
                include,
                clientIntention,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



