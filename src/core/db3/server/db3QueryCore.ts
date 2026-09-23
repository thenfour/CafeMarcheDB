import { AuthenticatedCtx, AuthorizationError, paginate } from "blitz";
import { randomUUID } from "crypto";
import db from "db";
import { sleep } from "shared/utils";
import { getRequestAuthorization, type RequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import type { TAnyModel } from "@/shared/rootroot";
import { authorizeAndProjectDB3ViewModel, projectDB3ModelPublicIds } from "./db3PublicIds";

export class DB3QueryAuthorizationError extends AuthorizationError {
    constructor() {
        super();
        this.message = "Not authorized to perform this query.";
        this.name = "DB3QueryAuthorizationError";
    }
}

async function prepareTableQuery(input: db3.QueryInputBase, authorization: RequestAuthorization) {
    const table = db3.GetTableById(input.table.tableID);
    const view = input.table.viewID ? db3.getDB3View(input.table.viewID) : undefined;
    if (view && view.tableID !== table.tableID) {
        throw new Error(`DB3 view '${view.viewID}' does not belong to table '${table.tableID}'.`);
    }
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
    const tableWhere = await table.CalculateWhereClause({ publicData, includeDeleted, filterModel: input.filter });
    const viewWhere = view?.getWhereClause({
        filter: input.filter,
        authorization: publicData,
    });
    const where = tableWhere && viewWhere
        ? { AND: [tableWhere, viewWhere] }
        : tableWhere || viewWhere;
    const selectionArgs = await table.CalculateSelectionArgs(
        publicData,
        input.filter,
        includeDeleted,
        view?.getSelectionArgs,
    );
    return { table, view, publicData, includeDeleted, where, selectionArgs };
}

function sanitizeQueryRows(items: TAnyModel[], query: Awaited<ReturnType<typeof prepareTableQuery>>, contextDesc: string): TAnyModel[] {
    if (query.view) {
        return items
            .map(model => authorizeAndProjectDB3ViewModel(
                query.table,
                model,
                query.publicData,
                contextDesc,
                query.includeDeleted,
            ))
            .filter((model): model is TAnyModel => model !== null)
            .map(model => query.view!.parseDto(model));
    }

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

export interface QueryTableExecutionOptions {

    // allows a caller to specify the returned sort order.
    // used by search queries;
    // those queries work in 2 stages:
    // 1. do filtering/sorting; collect list of primary keys in order. this is done in raw SQL.
    // 2. load full objects, using Prisma.
    // so this is the bridge between 1 and 2
    orderedPrimaryKeys?: readonly (number | string)[];
}

// takes an ordered list of pks, and an unordered list of items;
// returns items ordered according to the orderedPrimaryKeys array
function orderRawRowsByPrimaryKey<T extends TAnyModel>(
    items: T[],
    primaryKeyMember: string,
    orderedPrimaryKeys: readonly (number | string)[] | undefined,
): T[] {
    if (!orderedPrimaryKeys) {
        return items;
    }
    // map of pk -> item
    const byPrimaryKey = new Map(items.map(item => [item[primaryKeyMember], item]));

    return orderedPrimaryKeys.flatMap(primaryKey => {
        const item = byPrimaryKey.get(primaryKey);
        return item ? [item] : [];
    });
}

export async function queryTable(
    input: db3.QueryRequestInput,
    authorization: RequestAuthorization,
    database: TransactionalPrismaClient = db,
    executionOptions: QueryTableExecutionOptions = {},
) {
    const startTimestamp = Date.now();
    const query = await prepareTableQuery(input, authorization);
    const items = await database[query.table.tableName].findMany({
        where: query.where,
        orderBy: input.orderBy || query.table.naturalOrderBy,
        take: input.take,
        ...query.selectionArgs,
    });
    const orderedItems = orderRawRowsByPrimaryKey(
        items,
        query.table.pkMember,
        executionOptions.orderedPrimaryKeys,
    );
    if (input.delayMS) await sleep(input.delayMS);
    return {
        items: sanitizeQueryRows(orderedItems, query, `query:${query.table.tableName}`),
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
