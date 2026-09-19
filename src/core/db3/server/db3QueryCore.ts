import { AuthenticatedCtx, AuthorizationError, paginate } from "blitz";
import { randomUUID } from "crypto";
import db from "db";
import { sleep } from "shared/utils";
import { getRequestAuthorization, type RequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import type { TAnyModel } from "@/shared/rootroot";
import { projectDB3ModelPublicIds } from "./db3PublicIds";

export class DB3QueryAuthorizationError extends AuthorizationError {
    constructor() {
        super();
        this.message = "Not authorized to perform this query.";
        this.name = "DB3QueryAuthorizationError";
    }
}

async function prepareTableQuery(input: db3.QueryInputBase, authorization: RequestAuthorization) {
    const table = db3.GetTableById(input.table.tableID);
    const publicData = db3.createDB3Authorization(authorization.user, authorization.effectivePermissions);
    const includeDeleted = input.includeDeleted === true;

    if (!table.authorizeTableForView(publicData) || !table.authorizeIncludeDeleted(publicData, includeDeleted)) {
        throw new DB3QueryAuthorizationError();
    }
    const authorizeField = (columnName: string) => {
        if (!table.authorizeColumnForView({ model: null, publicData, columnName })) {
            throw new DB3QueryAuthorizationError();
        }
    };
    input.filter.items?.forEach(item => authorizeField(item.field));
    if (input.orderBy) authorizeField(Object.keys(input.orderBy)[0]!);
    if (input.filter.pks) authorizeField(table.pkMember);
    if (input.filter.publicIds) authorizeField(table.publicIdMember!);
    Object.keys(input.filter.tableParams || {}).forEach(parameterName => {
        if (!table.authorizeQueryParameter(parameterName, publicData)) throw new DB3QueryAuthorizationError();
    });
    const where = await table.CalculateWhereClause({ publicData, includeDeleted, filterModel: input.filter });
    const selectionArgs = await table.CalculateSelectionArgs(publicData, input.filter, includeDeleted);
    return { table, publicData, includeDeleted, where, selectionArgs };
}

function sanitizeQueryRows(items: TAnyModel[], query: Awaited<ReturnType<typeof prepareTableQuery>>, contextDesc: string): TAnyModel[] {
    return items.map(model => query.table.authorizeAndSanitize({
        contextDesc,
        publicData: query.publicData,
        includeDeleted: query.includeDeleted,
        rowMode: "view",
        model,
        fallbackOwnerId: null,
    }))
        .filter(result => result.rowIsAuthorized)
        .map(result => (
            projectDB3ModelPublicIds(query.table, result.authorizedModel, query.publicData)
        ));
}

export async function queryTable(input: db3.QueryRequestInput, authorization: RequestAuthorization, database: TransactionalPrismaClient = db) {
    const startTimestamp = Date.now();
    const query = await prepareTableQuery(input, authorization);
    const items = await database[query.table.tableName].findMany({
        where: query.where,
        orderBy: input.orderBy || query.table.naturalOrderBy,
        take: input.take,
        ...query.selectionArgs,
    });
    if (input.delayMS) await sleep(input.delayMS);
    return {
        items: sanitizeQueryRows(items, query, `query:${query.table.tableName}`),
        where: query.where,
        selectionArgs: query.selectionArgs,
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
}

export const DB3QueryCore = async (request: db3.QueryRequestInput, ctx: AuthenticatedCtx) => (
    queryTable(request, await getRequestAuthorization(ctx.session))
);

export async function DB3PaginatedQueryCore(input: db3.PaginatedQueryRequestInput, ctx: AuthenticatedCtx) {
    const startTimestamp = Date.now();
    const query = await prepareTableQuery(input, await getRequestAuthorization(ctx.session));
    const delegate = db[query.table.tableName];
    const { items, ...pagination } = await paginate({
        skip: input.skip,
        take: input.take,
        count: () => delegate.count({ where: query.where }),
        query: paginateArgs => delegate.findMany({
            ...paginateArgs,
            where: query.where,
            orderBy: input.orderBy || query.table.naturalOrderBy,
            ...query.selectionArgs,
        }),
    });
    if (input.delayMS) await sleep(input.delayMS);
    return {
        items: sanitizeQueryRows(items as TAnyModel[], query, `paginatedQuery:${query.table.tableName}`),
        ...pagination,
        where: query.where,
        selectionArgs: query.selectionArgs,
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
}
