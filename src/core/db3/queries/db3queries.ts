import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { AuthenticatedCtx } from "blitz";
import { CMDBAuthorizeOrThrow } from "types";
import * as mutationCore from "../server/db3mutationCore"
import { TAnyModel } from "shared/utils";

export default resolver.pipe(
    //resolver.authorize("db3query", Permission.login),
    async (input: db3.QueryInput, ctx: AuthenticatedCtx) => {
        try {
            const table = db3.GetTableById(input.tableID);
            console.assert(!!table);
            const contextDesc = `query:${table.tableName}`;

            // a jolting experience is a new user signs up, and immediately gets a full-page exception because of this next call.
            // the solution is not to lighten authorization handling here, but rather to build the client in such a way
            // that it doesn't query things it shouldn't.
            //CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);
            const dbTableClient = db[table.tableName]; // the prisma interface

            const orderBy = input.orderBy || table.naturalOrderBy;

            const clientIntention = input.clientIntention;
            if (!input.clientIntention) {
                throw new Error(`client intention is required; context: ${input.cmdbQueryContext}.`);
            }
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            if (clientIntention.intention === "public") {
                // for public intentions, no user should be used.
                clientIntention.currentUser = undefined;
            }
            else {
                clientIntention.currentUser = currentUser;
            }
            const where = await table.CalculateWhereClause({
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



