import { AuthenticatedCtx, paginate } from "blitz";
import { randomUUID } from "crypto";
import db from "db";
import { sleep } from "shared/utils";
import { CreatePublicData } from "types";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TAnyModel, TransactionalPrismaClient } from "../shared/apiTypes";
import { UserWithRolesPayload } from "../shared/schema/userPayloads";



export const DB3QueryCore2 = async (input: db3.QueryInput, currentUser: UserWithRolesPayload | null, __transactionalDb?: TransactionalPrismaClient) => {
    try {
        const startTimestamp = Date.now();
        const table = db3.GetTableById(input.tableID);
        console.assert(!!table);
        const contextDesc = `query:${table.tableName}`;

        const transactionalDb: TransactionalPrismaClient = (__transactionalDb as any) || (db as any); // have to do this way to avoid excessive stack depth by vs code

        // a jolting experience is a new user signs up, and immediately gets a full-page exception because of this next call.
        // the solution is not to lighten authorization handling here, but rather to build the client in such a way
        // that it doesn't query things it shouldn't.
        //CMDBAuthorizeOrThrow(contextDesc, table.viewPermission, ctx);
        const dbTableClient = (transactionalDb || db)[table.tableName]; // the prisma interface

        const orderBy = input.orderBy || table.naturalOrderBy;

        const clientIntention = input.clientIntention;
        if (!input.clientIntention) {
            throw new Error(`client intention is required; context: ${input.cmdbQueryContext}.`);
        }
        //const currentUser = await mutationCore.getCurrentUserCore(ctx);
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

        const selectionArgs = table.CalculateSelectionArgs(clientIntention, input.filter);

        const items = await dbTableClient.findMany({
            where,
            orderBy,
            take: input.take,
            ...selectionArgs,
        });

        const publicData = CreatePublicData({
            user: currentUser,
        });

        const rowAuthResult = (items as TAnyModel[]).map(row => table.authorizeAndSanitize({
            contextDesc,
            publicData,
            clientIntention,
            rowMode: "view",
            model: row,
            fallbackOwnerId: null, // assume model contains this
        }));

        // any unknown / unauthorized columns are simply discarded.
        const sanitizedItems = rowAuthResult.filter(r => r.rowIsAuthorized).map(r => r.authorizedModel);

        if (input.delayMS) {
            await sleep(input.delayMS);
        }

        return {
            items: sanitizedItems,
            where,
            selectionArgs,
            clientIntention,
            executionTimeMillis: Date.now() - startTimestamp,
            resultId: randomUUID(),
        };
    } catch (e) {
        console.error(e);
        throw (e);
    }
};







export const DB3QueryCore = async (input: db3.QueryInput, ctx: AuthenticatedCtx) => {
    const currentUser = await mutationCore.getCurrentUserCore(ctx);
    return await DB3QueryCore2(input, currentUser);
};



export const DB3PaginatedQueryCore = async (input: db3.PaginatedQueryInput, ctx: AuthenticatedCtx) => {
    const startTimestamp = Date.now();
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

    const selectionArgs = table.CalculateSelectionArgs(clientIntention, input.filter);

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
                ...selectionArgs,
            }),
    });

    const rowAuthResult = (items as TAnyModel[]).map(row => table.authorizeAndSanitize({
        contextDesc,
        publicData: ctx.session.$publicData,
        clientIntention,
        rowMode: "view",
        model: row,
        fallbackOwnerId: null, // assume model contains this
    }));

    // any unknown / unauthorized columns are simply discarded.
    const sanitizedItems = rowAuthResult.filter(r => r.rowIsAuthorized).map(r => r.authorizedModel);

    if (input.delayMS) {
        await sleep(input.delayMS);
    }

    return {
        items: sanitizedItems,
        nextPage,
        hasMore,
        count,

        where,
        selectionArgs,
        clientIntention,
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
};





