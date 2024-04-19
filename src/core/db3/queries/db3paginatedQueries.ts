import { AuthenticatedCtx, paginate } from "blitz";
import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import * as db3 from "../db3";
import { CMDBAuthorizeOrThrow } from "types";
import { Permission } from "shared/permissions";
import * as mutationCore from "../server/db3mutationCore"
import { TAnyModel } from "shared/utils";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (input: db3.PaginatedQueryInput, ctx: AuthenticatedCtx) => {
        try {
            const table = db3.GetTableById(input.tableID);
            const contextDesc = `paginatedQuery:${table.tableName}`;
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            const clientIntention = input.clientIntention;
            if (!input.clientIntention) {
                throw new Error(`client intention is required; context: ${input.cmdbQueryContext}.`);
            }
            clientIntention.currentUser = currentUser;

            const dbTableClient = db[table.tableName]; // the prisma interface
            const orderBy = input.orderBy || table.naturalOrderBy;

            const where = await table.CalculateWhereClause({
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

            const rowAuthResult = (items as TAnyModel[]).map(row => table.authorizeAndSanitize({
                contextDesc,
                publicData: ctx.session.$publicData,
                clientIntention,
                rowMode: "view",
                model: row,
            }));

            // any unknown / unauthorized columns are simply discarded.
            const sanitizedItems = rowAuthResult.filter(r => r.rowIsAuthorized).map(r => r.authorizedModel);

            return {
                items: sanitizedItems,
                nextPage,
                hasMore,
                count,

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





