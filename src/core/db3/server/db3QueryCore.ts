import type { DB3ServerAuthorization } from "./db3ServerAuthorization";
import { AuthenticatedCtx, AuthorizationError, paginate } from "blitz";
import { randomUUID } from "crypto";
import db from "db";
import { sleep } from "shared/utils";
import { getRequestAuthorization, type RequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import type { TAnyModel } from "@/shared/rootroot";
import { db3Server } from "./db3Server";
import {
    authorizeAndProjectDB3ViewModel,
    projectDB3ModelPublicIds,
    resolvePublicQueryParameters,
} from "./db3PublicIds";

export class DB3QueryAuthorizationError extends AuthorizationError {
    constructor() {
        super();
        this.message = "Not authorized to perform this query.";
        this.name = "DB3QueryAuthorizationError";
    }
}

async function prepareTableQuery(
    input: db3.LegacyQueryInputBase,
    authorization: RequestAuthorization,
    database: TransactionalPrismaClient,
    executionOptions: QueryTableExecutionOptions = {},
) {
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
    const resolvedTableParams = await resolvePublicQueryParameters(
        table,
        input.filter.tableParams || {},
        publicData,
        database,
    );
    const resolvedFilter = {
        ...input.filter,
        tableParams: resolvedTableParams,
    };
    const tableWhere = table.CalculateWhereClause({
        publicData,
        includeDeleted,
        filterModel: resolvedFilter,
    });
    const viewWhere = view?.getWhereClause({
        filter: resolvedFilter,
        authorization: publicData,
    });
    const where = tableWhere && viewWhere
        ? { AND: [tableWhere, viewWhere] }
        : tableWhere || viewWhere;
    const selectionArgs = await table.CalculateSelectionArgs(
        publicData,
        resolvedFilter,
        includeDeleted,
        view?.getSelectionArgs,
    );
    const readSelection = db3Server.table(table).prepareReadSelection(
        selectionArgs ?? {},
        executionOptions.orderedPrimaryKeys ? [table.pkMember] : [],
    );
    return { table, view, publicData, includeDeleted, where, selectionArgs: readSelection.selection, readSelection };
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
            .map(model => query.view!.parseDto(query.readSelection.stripSupportFields(model)));
    }

    return items.map(model => {
        db3Server.table(query.table).assertReadAuthorizationInput(model, contextDesc);
        return query.table.authorizeAndSanitize({
            contextDesc,
            publicData: query.publicData,
            includeDeleted: query.includeDeleted,
            rowMode: "view",
            model,
            fallbackOwnerId: null,
        });
    })
        .filter(result => result.rowIsAuthorized)
        .map(result => {
            const projected = query.readSelection.stripSupportFields(
                projectDB3ModelPublicIds(query.table, result.authorizedModel, query.publicData),
            );
            return projected;

            // TODO: this is a table-specific hack and i won't put it in db3 core.
            // i will instead do a manual correction script.

            // if (query.table.tableName !== "Change") return projected;
            // // Historical change JSON can contain numeric user IDs in arbitrary
            // // nested data. Keep the stored audit record, but redact its raw
            // // values before any Change row crosses the RPC boundary.
            // return {
            //     ...projected,
            //     recordId: projected.table === "User" ? null : projected.recordId,
            //     oldValues: null,
            //     newValues: null,
            // };
        });
}

export interface QueryTableExecutionOptions {

    // allows a caller to specify the returned sort order.
    // used by search queries;
    // those queries work in 2 stages:
    // 1. do filtering/sorting; collect list of primary keys in order. this is done in raw SQL.
    // 2. load full objects, using Prisma.
    // so this is the bridge between 1 and 2
    orderedPrimaryKeys?: readonly (number | string)[];

    // Search SQL returns trusted natural keys after applying its authorized
    // filter. Keep those keys out of the client query contract while the DB3
    // read still reapplies row policy and projection to the loaded rows.
    trustedNaturalPrimaryKeys?: readonly number[];
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
    const byPrimaryKey = new Map(items.map(item => {
        const key = item[primaryKeyMember];
        if (key === undefined || key === null) {
            throw new Error(`DB3 ordered read is missing required primary key '${primaryKeyMember}'.`);
        }
        return [key, item];
    }));

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
    const query = await prepareTableQuery(input, authorization, database, executionOptions);
    const trustedPrimaryKeyWhere = executionOptions.trustedNaturalPrimaryKeys
        ? { [query.table.pkMember]: { in: executionOptions.trustedNaturalPrimaryKeys } }
        : undefined;
    const where = query.where && trustedPrimaryKeyWhere
        ? { AND: [query.where, trustedPrimaryKeyWhere] }
        : query.where || trustedPrimaryKeyWhere;
    const items = await database[query.table.tableName].findMany({
        where,
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
        //where,
        selectionArgs: query.selectionArgs,
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
}

export type QueryViewInput<TView extends db3.AnyDB3View> = Omit<
    db3.QueryInputBase<NoInfer<TView>>,
    "table"
> & {
    readonly view: TView;
    readonly take?: number;
};

export type QueryViewResult<TView extends db3.AnyDB3View> = Omit<
    Awaited<ReturnType<typeof queryTable>>,
    "items"
> & {
    readonly items: db3.DtoOf<TView>[];
};

export type QueryHydratedViewResult<TView extends db3.AnyDB3View> = Omit<
    QueryViewResult<TView>,
    "items"
> & {
    readonly items: db3.ClientOf<TView>[];
};

/** Authorizes a single selected row and produces its transport DTO. */
export function authorizeAndProjectViewDto<
    TView extends db3.AnyDB3View,
    TModel extends db3.DbPayloadOf<TView>,
>(
    view: TView,
    model: TModel,
    publicData: DB3ServerAuthorization,
    contextDesc: string,
): db3.DtoOf<TView> | null {
    const projected = authorizeAndProjectDB3ViewModel(
        view.entity,
        model,
        publicData,
        contextDesc,
    );
    if (!projected) return null;
    return view.parseDto(projected);
}

/** Explicit hydration for server consumers, not RPC return values. */
export function authorizeAndHydrateViewModel<
    TView extends db3.AnyDB3View,
    TModel extends db3.DbPayloadOf<TView>,
>(
    view: TView,
    model: TModel,
    publicData: DB3ServerAuthorization,
    references: db3.DB3ReferenceProvider<db3.ReferenceContractOf<NoInfer<TView>>>,
    contextDesc: string,
): db3.ClientOf<TView> | null {
    const dto = authorizeAndProjectViewDto(view, model, publicData, contextDesc);
    return dto === null ? null : db3.hydrateView(view, dto, references);
}

/** Named-view query returning authorized, validated transport DTOs. */
export async function queryView<TView extends db3.AnyDB3View>(
    input: QueryViewInput<TView>,
    authorization: RequestAuthorization,
    database: TransactionalPrismaClient = db,
    executionOptions: QueryTableExecutionOptions = {},
): Promise<QueryViewResult<TView>> {
    const { view, ...queryInput } = input;
    if (db3.getDB3View(view.viewID) !== view) {
        throw new Error(`DB3 view '${view.viewID}' is not the registered view instance.`);
    }

    const result = await queryTable({
        ...queryInput,
        orderBy: queryInput.orderBy,
        table: {
            tableID: view.tableID,
            tableName: view.tableName,
            viewID: view.viewID,
        },
    }, authorization, database, executionOptions);

    // queryTable resolved the exact view instance above and parseDto validated
    // every returned item, so its untyped transport array has this view's DTO type.
    const dtos = result.items as db3.DtoOf<TView>[];
    return {
        ...result,
        items: dtos,
    };
}

/** Query and hydrate when a server consumer needs the view's client shape. */
export async function queryHydratedView<TView extends db3.AnyDB3View>(
    input: QueryViewInput<TView>,
    authorization: RequestAuthorization,
    references: db3.DB3ReferenceProvider<db3.ReferenceContractOf<NoInfer<TView>>>,
    database: TransactionalPrismaClient = db,
    executionOptions: QueryTableExecutionOptions = {},
): Promise<QueryHydratedViewResult<TView>> {
    const result = await queryView(input, authorization, database, executionOptions);
    return {
        ...result,
        items: result.items.map(dto => db3.hydrateView(input.view, dto, references)),
    };
}

export const DB3QueryCore = async (request: db3.QueryRequestInput, ctx: AuthenticatedCtx) => (
    queryTable(request, await getRequestAuthorization(ctx.session))
);

export async function DB3PaginatedQueryCore(input: db3.PaginatedQueryRequestInput, ctx: AuthenticatedCtx) {
    const startTimestamp = Date.now();
    const query = await prepareTableQuery(input, await getRequestAuthorization(ctx.session), db);
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
        //where: query.where,
        selectionArgs: query.selectionArgs,
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
}
