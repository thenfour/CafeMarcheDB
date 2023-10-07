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
            const table = db3.gAllTables[input.tableName]!;
            console.assert(!!table);
            const contextDesc = `query:${table.tableName}`;
            CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);
            const dbTableClient = db[table.tableName]; // the prisma interface

            const currentUser = await db.user.findFirst({
                ...db3.UserWithRolesArgs,
                where: {
                    id: ctx.session.userId,
                }
            });

            if (currentUser == null) {
                throw new Error(`current user not found`);
            }

            const orderBy = input.orderBy || table.naturalOrderBy;
            const clientIntention = input.clientIntention;
            clientIntention.currentUser = currentUser;
            const where = table.CalculateWhereClause({
                clientIntention,
                filterModel: input.filter,
            });

            const items = await dbTableClient.findMany({
                where,
                orderBy,
                include: table.localInclude,
                take: input.take,
            });
            return items;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



