import { AuthenticatedCtx, AuthorizationError, paginate } from "blitz";
const { randomUUID } = require("crypto") as typeof import("crypto");
import db from "db";
import { sleep } from "shared/utils";
import { CreatePublicData } from "types";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TransactionalPrismaClient } from "../shared/apiTypes";
import { UserWithRolesPayload } from "../shared/schema/userPayloads";
import { TAnyModel } from "@/shared/rootroot";
import { deriveDB3ClientIntention } from "./db3RequestValidation";

export class DB3QueryAuthorizationError extends AuthorizationError {
    constructor() {
        super();
        this.message = "Not authorized to perform this DB3 query.";
        this.name = "DB3QueryAuthorizationError";
    }
}

const authorizeQueryBeforeDatabaseAccess = (
    table: db3.xTable,
    input: db3.QueryInput | db3.PaginatedQueryInput,
    publicData: ReturnType<typeof CreatePublicData>,
): void => {
    if (input.clientIntention.intention === "admin" && !publicData.isSysAdmin) {
        throw new DB3QueryAuthorizationError();
    }
    if (!table.authorizeTableForView(publicData)) throw new DB3QueryAuthorizationError();

    const authorizeField = (columnName: string) => {
        if (!table.authorizeColumnForView({
            model: null,
            publicData,
            clientIntention: input.clientIntention,
            columnName,
        })) throw new DB3QueryAuthorizationError();
    };

    input.filter.items.forEach(item => authorizeField(item.field));
    if (input.orderBy) authorizeField(Object.keys(input.orderBy)[0]!);
    if (input.filter.pks) authorizeField(table.pkMember);

    Object.keys(input.filter.tableParams || {}).forEach(parameterName => {
        if (!table.authorizeQueryParameter(parameterName, publicData, input.clientIntention)) {
            throw new DB3QueryAuthorizationError();
        }
    });
};

export const DB3QueryCore2 = async (input: db3.QueryInput, currentUser: UserWithRolesPayload | null, __transactionalDb?: TransactionalPrismaClient) => {
    try {
        const startTimestamp = Date.now();
        const table = db3.GetTableById(input.tableID);
        console.assert(!!table);
        const contextDesc = `query:${table.tableName}`;

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

        const authorizationUser = clientIntention.intention === "public" ? null : currentUser;
        const publicData = CreatePublicData({ user: authorizationUser });
        authorizeQueryBeforeDatabaseAccess(table, input, publicData);

        const transactionalDb: TransactionalPrismaClient = (__transactionalDb as any) || (db as any); // have to do this way to avoid excessive stack depth by vs code
        const dbTableClient = (transactionalDb || db)[table.tableName]; // the prisma interface
        const orderBy = input.orderBy || table.naturalOrderBy;

        const where = await table.CalculateWhereClause({
            clientIntention,
            filterModel: input.filter,
            publicData,
        });

        const selectionArgs = table.CalculateSelectionArgs(clientIntention, input.filter);

        const items = await dbTableClient.findMany({
            where,
            orderBy,
            take: input.take,
            ...selectionArgs,
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
            executionTimeMillis: Date.now() - startTimestamp,
            resultId: randomUUID(),
        };
    } catch (e) {
        console.error(e);
        throw (e);
    }
};







export const DB3QueryCore = async (request: db3.QueryRequestInput, ctx: AuthenticatedCtx) => {
    const currentUser = await mutationCore.getCurrentUserCore(ctx);
    const input: db3.QueryInput = {
        ...request,
        clientIntention: deriveDB3ClientIntention("query", currentUser),
    };
    return await DB3QueryCore2(input, currentUser);
};



export const DB3PaginatedQueryCore = async (request: db3.PaginatedQueryRequestInput, ctx: AuthenticatedCtx) => {
    const startTimestamp = Date.now();
    const currentUser = await mutationCore.getCurrentUserCore(ctx);
    const input: db3.PaginatedQueryInput = {
        ...request,
        clientIntention: deriveDB3ClientIntention("paginatedQuery", currentUser),
    };
    const table = db3.GetTableById(input.tableID);
    const contextDesc = `paginatedQuery:${table.tableName}`;
    const clientIntention = input.clientIntention;
    const publicData = CreatePublicData({ user: currentUser });

    authorizeQueryBeforeDatabaseAccess(table, input, publicData);

    const dbTableClient = db[table.tableName]; // the prisma interface
    const orderBy = input.orderBy || table.naturalOrderBy;

    const where = await table.CalculateWhereClause({
        clientIntention,
        filterModel: input.filter,
        publicData,
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
        nextPage,
        hasMore,
        count,

        where,
        selectionArgs,
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
};





