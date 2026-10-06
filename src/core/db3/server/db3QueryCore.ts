import type { TAnyModel } from "@/shared/rootroot";
import { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
import { AuthorizationError, paginate } from "blitz";
import { randomUUID } from "crypto";
import db from "db";
import { sleep } from "shared/utils";
import * as db3 from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import { MAX_DB3_PAGE_SIZE } from "../shared/apiTypes";
import {
    authorizeAndProjectDB3ViewModel,
    projectDB3ModelPublicIds,
    resolvePublicQueryParameters,
} from "./db3PublicIds";
import { db3Server } from "./db3Server";
import { executeDB3Read } from "./db3ReadExecution";
import { resolveDB3ReadRows } from "./db3ResolvedFields";
import { queryDB3Memory } from "../shared/core/db3MemoryQuery";
import { collectLocalePreferences, selectFormattingLocale } from "src/locale/shared/localePreferences";

export class DB3QueryAuthorizationError extends AuthorizationError {
    constructor() {
        super();
        this.message = "Not authorized to perform this query.";
        this.name = "DB3QueryAuthorizationError";
    }
}

async function prepareTableQuery(
    input: db3.LegacyQueryInputBase,
    auth: CMServerAuthorization,
    database: TransactionalPrismaClient,
    executionOptions: QueryTableExecutionOptions = {},
) {
    const table = db3.GetTableById(input.table.tableID);
    const view = input.table.viewID ? db3.getDB3View(input.table.viewID) : undefined;
    if (view && view.tableID !== table.tableID) {
        throw new Error(`DB3 view '${view.viewID}' does not belong to table '${table.tableID}'.`);
    }
    if (input.table.tableName !== table.tableName) {
        throw new Error("The table name does not match its registered identity.");
    }
    if (auth.band && !table.bandScope) {
        throw new DB3QueryAuthorizationError();
    }
    if (input.bandPublicId != null && input.bandPublicId !== auth.requireBand().publicId) {
        throw new DB3QueryAuthorizationError();
    }
    if (table.queryStrategy === "resolved" && !view) {
        throw new Error("Resolved DB3 reads require a named view.");
    }
    const includeDeleted = input.includeDeleted === true;

    if (!table.authorizeTableForView(auth) || !table.authorizeIncludeDeleted(auth, includeDeleted)) {
        throw new DB3QueryAuthorizationError();
    }
    const authorizeField = (columnName: string) => {
        if (!table.authorizeColumnForView({ model: null, auth, columnName })) {
            throw new DB3QueryAuthorizationError();
        }
    };
    input.filter.items?.forEach(item => authorizeField(item.field));
    if (input.orderBy) {
        Object.keys(input.orderBy).forEach(authorizeField);
    }
    if (input.filter.pks) authorizeField(table.pkMember);
    if (input.filter.publicIds) authorizeField(table.publicIdMember!);
    Object.keys(input.filter.tableParams || {}).forEach(parameterName => {
        if (!table.authorizeQueryParameter(parameterName, auth)) {
            throw new DB3QueryAuthorizationError();
        }
    });
    const resolvedTableParams = await resolvePublicQueryParameters(
        table,
        input.filter.tableParams || {},
        auth,
        database,
    );
    const resolvedFilter = {
        ...input.filter,
        tableParams: resolvedTableParams,
    };
    const tableWhere = table.CalculateWhereClause({
        auth,
        includeDeleted,
        filterModel: resolvedFilter,
        structuralOnly: table.queryStrategy === "resolved",
    });
    const viewWhere = view?.getWhereClause({
        filter: resolvedFilter,
        auth,
    });
    const where = tableWhere && viewWhere
        ? { AND: [tableWhere, viewWhere] }
        : tableWhere || viewWhere;
    const selectionArgs = await table.CalculateSelectionArgs(
        auth,
        resolvedFilter,
        includeDeleted,
        view?.getSelectionArgs,
    );
    // Small resolved catalogs fetch authorized field dependencies even for a narrow transport view.
    // Filtering and natural ordering must not depend on which columns the caller chose to display.
    const querySupportMembers = table.queryStrategy === "resolved" ? table.columns
        .filter(field => table.authorizeColumnForView({ model: null, auth, columnName: field.member }))
        .flatMap(field => field.getPrismaMemberDescriptors().map(descriptor => descriptor.member)) : [];
    const readSelection = db3Server.table(table).prepareReadSelection(
        selectionArgs ?? {},
        [...querySupportMembers, ...(executionOptions.orderedPrimaryKeys ? [table.pkMember] : [])],
    );
    return { table, view, auth, includeDeleted, where, selectionArgs: readSelection.selection, readSelection };
}

function sanitizeQueryRows(items: TAnyModel[], query: Awaited<ReturnType<typeof prepareTableQuery>>, contextDesc: string): TAnyModel[] {
    if (query.view) {
        return items
            .map(model => authorizeAndProjectDB3ViewModel(
                query.table,
                model,
                query.auth,
                contextDesc,
                query.includeDeleted,
            ))
            .filter((model): model is TAnyModel => model !== null)
            .map(model => query.view!.parseDto(query.readSelection.stripSupportFields(model)));
    }

    // Legacy table reads authorize the parent fields without recursively
    // authorizing selected relations. New reads should use queryView or apply
    // their own authorization and sanitization before returning a payload.
    return items.map(model => {
        db3Server.table(query.table).assertReadAuthorizationInput(model, contextDesc);
        return query.table.authorizeAndSanitize({
            contextDesc,
            auth: query.auth,
            includeDeleted: query.includeDeleted,
            rowMode: "view",
            model,
            fallbackOwnerId: null,
        });
    })
        .filter(result => result.rowIsAuthorized)
        .map(result => {
            const projected = query.readSelection.stripSupportFields(
                projectDB3ModelPublicIds(query.table, result.authorizedModel, query.auth),
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

// This registry-level boundary returns heterogeneous tables. Named queryView callers recover their validated DTO type.
interface DB3TableQueryResult {
    items: TAnyModel[];
    executionTimeMillis: number;
    resultId: string;
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

async function queryTableInContext(
    input: db3.QueryRequestInput,
    auth: CMServerAuthorization,
    database: TransactionalPrismaClient = db,
    executionOptions: QueryTableExecutionOptions = {},
): Promise<DB3TableQueryResult> {
    const startTimestamp = Date.now();

    const query = await prepareTableQuery(input, auth, database, executionOptions);
    if (query.table.queryStrategy === "resolved") {
        if (executionOptions.orderedPrimaryKeys || executionOptions.trustedNaturalPrimaryKeys) {
            throw new Error("Resolved DB3 reads use field ordering and public identities.");
        }
        const result = await queryResolvedRowsInMemory(input, query, database, 0, input.take);
        return { items: result.items, executionTimeMillis: Date.now() - startTimestamp, resultId: randomUUID() };
    }
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
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
}

/** Shared execution owns snapshot consistency and fresh grants for band-scoped reads. */
export async function queryTable(input: db3.QueryRequestInput, auth: CMServerAuthorization,
    database: TransactionalPrismaClient = db, executionOptions: QueryTableExecutionOptions = {},
): Promise<DB3TableQueryResult> {
    const table = db3.GetTableById(input.table.tableID);
    return table.bandScope
        ? executeDB3Read(database, auth, context => queryTableInContext(input, context.authorization, context.database, executionOptions))
        : queryTableInContext(input, auth, database, executionOptions);
}

// if you've brought a table in memory to perform dynamic resolution of queryable fields
// (e.g. SongTag table needs its localized strings resolved in code)
// and want to  query over that...
async function queryResolvedRowsInMemory(input: db3.LegacyQueryInputBase, query: Awaited<ReturnType<typeof prepareTableQuery>>,
    database: TransactionalPrismaClient, skip: number, take?: number,
) {
    const rawRows = await database[query.table.tableName].findMany({ where: query.where, ...query.selectionArgs });
    const resolved = await resolveDB3ReadRows(query.table, rawRows, database, query.auth, input);
    // Authorize before matching, so protected fields cannot affect matches, counts, or order.
    const authorized = resolved.map(row => authorizeAndProjectDB3ViewModel(
        query.table, row, query.auth, `resolvedQuery:${query.table.tableName}`, query.includeDeleted,
    )).filter((row): row is TAnyModel => row !== null);
    const result = queryDB3Memory(query.table, authorized, input.filter, query.auth,
        input.orderBy, selectFormattingLocale(collectLocalePreferences(input)), skip, take);
    return { ...result, items: result.items.map(row => query.view!.parseDto(query.readSelection.stripSupportFields(row))) };
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
    auth: CMServerAuthorization,
    contextDesc: string,
): db3.DtoOf<TView> | null {
    const projected = authorizeAndProjectDB3ViewModel(
        view.entity,
        model,
        auth,
        contextDesc,
    );
    if (!projected) {
        return null;
    }
    return view.parseDto(projected);
}

/** Explicit hydration for server consumers, not RPC return values. */
export function authorizeAndHydrateViewModel<
    TView extends db3.AnyDB3View,
    TModel extends db3.DbPayloadOf<TView>,
>(
    view: TView,
    model: TModel,
    auth: CMServerAuthorization,
    references: db3.DB3ReferenceProvider<db3.ReferenceContractOf<NoInfer<TView>>>,
    contextDesc: string,
): db3.ClientOf<TView> | null {
    const dto = authorizeAndProjectViewDto(view, model, auth, contextDesc);
    return dto === null ? null : db3.hydrateView(view, dto, references);
}

/** Named-view query returning authorized, validated transport DTOs. */
export async function queryView<TView extends db3.AnyDB3View>(
    input: QueryViewInput<TView>,
    auth: CMServerAuthorization,
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
    }, auth, database, executionOptions);

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
    auth: CMServerAuthorization,
    references: db3.DB3ReferenceProvider<db3.ReferenceContractOf<NoInfer<TView>>>,
    database: TransactionalPrismaClient = db,
    executionOptions: QueryTableExecutionOptions = {},
): Promise<QueryHydratedViewResult<TView>> {
    const result = await queryView(input, auth, database, executionOptions);
    return {
        ...result,
        items: result.items.map(dto => db3.hydrateView(input.view, dto, references)),
    };
}

// just replace by queryTable.
// export const DB3QueryCore = async (request: db3.QueryRequestInput, auth: CMServerAuthorization) => (
//     queryTable(request, await loadAuthorization(ctx.session))
// );

async function paginatedQueryInContext(input: db3.PaginatedQueryRequestInput, auth: CMServerAuthorization,
    database: TransactionalPrismaClient = db,
): Promise<DB3TableQueryResult & { count: number; hasMore: boolean; nextPage: { skip: number; take: number } | null }> {
    const startTimestamp = Date.now();

    const query = await prepareTableQuery(input, auth, database);
    if (query.table.queryStrategy === "resolved") {
        const result = await queryResolvedRowsInMemory(input, query, database, input.skip, input.take);
        const hasMore = input.skip + result.items.length < result.count;
        return {
            ...result, hasMore, nextPage: hasMore ? { skip: input.skip + input.take, take: input.take } : null,
            executionTimeMillis: Date.now() - startTimestamp, resultId: randomUUID()
        };
    }
    const delegate = database[query.table.tableName];
    const { items, ...pagination } = await paginate({
        skip: input.skip,
        take: input.take,
        maxTake: MAX_DB3_PAGE_SIZE,
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
        executionTimeMillis: Date.now() - startTimestamp,
        resultId: randomUUID(),
    };
}

export async function DB3PaginatedQueryCore(input: db3.PaginatedQueryRequestInput, auth: CMServerAuthorization,
    database: TransactionalPrismaClient = db,
): Promise<DB3TableQueryResult & { count: number; hasMore: boolean; nextPage: { skip: number; take: number } | null }> {
    const table = db3.GetTableById(input.table.tableID);
    return table.bandScope
        ? executeDB3Read(database, auth, context => paginatedQueryInContext(input, context.authorization, context.database))
        : paginatedQueryInContext(input, auth, database);
}
