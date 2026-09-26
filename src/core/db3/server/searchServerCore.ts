import type { DB3ServerAuthorization } from "./db3ServerAuthorization";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import { calendarWindowSql } from "./calendarWindowSql";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
// generalized version of search results.
// hopefully can unify song & event search, and then extend to users & files.

import { AuthenticatedCtx, AuthorizationError } from "blitz";
import db, { Prisma } from "db";
import { SqlCombineAndExpression, SqlCombineOrExpression } from "shared/mysqlUtils";
import { SplitQuickFilter } from "shared/quickFilter";
import { Stopwatch, TAnyModel } from "shared/rootroot";
import { queryTable } from "src/core/db3/server/db3QueryCore";
import { CalculateFilterQueryResult, type DiscreteCriterion, DiscreteCriterionFilterType, GetSearchResultsInput, MakeEmptySearchResultsRet, SearchResultsRet, SortQueryElements } from "src/core/db3/shared/apiTypes";
import * as db3 from "../../../core/db3/db3";
import { UserWithRolesPayload } from "../shared/schema/userPayloads";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";
import { resolvePublicIds } from "./db3PublicIds";



export function processSearchSortModel(table: db3.xTable, args: GetSearchResultsInput): SortQueryElements {
    // the sort order value is best added to this query to avoid having to join to the same table later in the paginated results query.
    const sortElementsArray: SortQueryElements[] = [];
    let sortSymbolNameId = 0;
    const getSortColumnAPI: db3.SqlGetSortableQueryElementsAPI = {
        primaryTableAlias: "P",
        sortModel: { // to be changed as we loop.
            db3Column: "",
            direction: "asc",
        },
        getColumnAlias: () => {
            return `sortCol_${++sortSymbolNameId}`;
        },
        getTableAlias: () => {
            return `sortTbl_${++sortSymbolNameId}`;
        },
    };

    for (let i = 0; i < args.sort.length; ++i) {
        const spec = args.sort[i]!;
        getSortColumnAPI.sortModel = spec;
        const orderByCol = table.getColumn(spec.db3Column);
        if (!orderByCol) {
            throw new Error(`Order by column ${spec.db3Column} not found on table ${table.tableName}`);
        }
        const sortElements = orderByCol.SqlGetSortableQueryElements(getSortColumnAPI);
        if (sortElements) {
            sortElementsArray.push(sortElements);
        }
    }

    // flatten sort columns
    const emptySortElements: SortQueryElements = {
        join: [],
        select: [],
    };
    const sortElements = sortElementsArray.reduce((acc, v) => {
        acc.join.push(...v.join);
        acc.select.push(...v.select);
        return acc;
    }, emptySortElements);

    return sortElements;
};

const optionBearingDiscreteBehaviors = new Set<DiscreteCriterionFilterType>([
    DiscreteCriterionFilterType.hasSomeOf,
    DiscreteCriterionFilterType.hasAllOf,
    DiscreteCriterionFilterType.doesntHaveAnyOf,
    DiscreteCriterionFilterType.doesntHaveAllOf,
]);

export async function resolveSearchDiscreteCriteria(
    table: db3.xTable,
    criteria: readonly DiscreteCriterion[],
    publicData: DB3ServerAuthorization,
    database: TransactionalPrismaClient,
): Promise<DiscreteCriterion[]> {
    return Promise.all(criteria.map(async criterion => {
        const column = table.getColumn(criterion.db3Column);
        if (!column) {
            throw new Error(`Search column ${criterion.db3Column} not found on table ${table.tableName}`);
        }
        const targetTable = column.getDiscreteCriterionTargetTable();
        if (!targetTable?.publicIdMember) return criterion;
        if (!optionBearingDiscreteBehaviors.has(criterion.behavior)) {
            // These modes do not consume options. A UI may retain an old
            // selection while switching modes, so do not resolve or assert it.
            return { ...criterion, options: [] };
        }
        return {
            ...criterion,
            options: await resolvePublicIds(
                targetTable,
                criterion.options,
                publicData,
                database,
            ),
        };
    }));
}

// construct a SQL select clause returning filtered items.
// no pagination or sorting applied yet
function calculateFilterQuery(currentUser: UserWithRolesPayload,
    args: GetSearchResultsInput,
    excludeCriterionColumn: string | null,
    sortElements: SortQueryElements,
    publicData: DB3ServerAuthorization,
    calendarPredicate: string | null,
): CalculateFilterQueryResult {
    const table = db3.GetTableById(args.tableID);
    if (!table) {
        throw new Error(`table ${args.tableID} not found`);
    }

    const result: CalculateFilterQueryResult = {
        sqlSelect: "",
        errors: [],
    }

    // each criterion will supply the info we need to construct the correct query.
    const whereAnd: string[] = [];
    if (args.calendarWindow) {
        if (table.tableName !== "Event") throw new Error("Calendar windows are only supported for event searches.");
        whereAnd.push(calendarPredicate!);
    }

    const qfTokens = SplitQuickFilter(args.quickFilter);
    for (let itok = 0; itok < qfTokens.length; ++itok) {
        const token = qfTokens[itok]!;
        const OR: string[] = [];
        for (let i = 0; i < table.columns.length; ++i) {
            const column = table.columns[i]!;
            // Quick filters search every eligible column implicitly. Treat that
            // as a read of the column so hidden data cannot be probed through
            // the presence or absence of matching rows.
            if (!table.authorizeColumnForView({
                model: null,
                publicData,
                columnName: column.member,
            })) continue;
            const orExpr = column.SqlGetQuickFilterElementsForToken(token, qfTokens);
            if (orExpr === null) continue;
            OR.push(orExpr);
        }

        // integrate elements
        whereAnd.push(SqlCombineOrExpression(OR));
    }

    for (let i = 0; i < args.discreteCriteria.length; ++i) {
        const criterion = args.discreteCriteria[i]!;
        const col = table.getColumn(criterion.db3Column);
        if (!col) {
            throw new Error(`Column ${criterion.db3Column} wasn't found on table ${table.tableName} / ID:${table.tableID}; unable to form the search query.`);
        }
        if (col.member === excludeCriterionColumn) {
            continue;
        }
        const elements = col.SqlGetDiscreteCriterionElements(criterion, "P");
        // no filtering to be done on this column
        if (!elements) continue;

        if (!!elements.error) {
            result.errors.push({
                column: criterion.db3Column,
                error: elements.error,
            });
            continue;
        }

        // integrate elements
        whereAnd.push(elements.whereAnd);
    }

    whereAnd.push(table.SqlGetVisFilterExpression(currentUser, "P", args.includeDeleted === true, publicData));

    const ret: string = `
        SELECT
            P.${table.pkMember} id,
            ${sortElements.select.map(m => `${m.expression} ${m.alias}`).join(", \n")}
        FROM 
            ${table.tableName} P
            ${sortElements.join.join(", \n")}
        WHERE
            ${SqlCombineAndExpression(whereAnd)}
        group by
            P.${table.pkMember}
    `;
    result.sqlSelect = ret;
    return result;
};

// export default resolver.pipe(
//     resolver.authorize(Permission.visibility_members), // ? right or?
//     resolver.zod(ZGetSearchResultsInput),
export async function GetSearchResultsCore(args: GetSearchResultsInput, ctx: AuthenticatedCtx): Promise<SearchResultsRet> {
    if (!args.calendarWindow) return getSearchResults(args, ctx, db);
    return db.$transaction(tx => getSearchResults(args, ctx, tx), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000,
    });
}

async function getSearchResults(args: GetSearchResultsInput, ctx: AuthenticatedCtx, database: TransactionalPrismaClient): Promise<SearchResultsRet> {
    try {
        const rootsw = new Stopwatch();
        const ret: SearchResultsRet = MakeEmptySearchResultsRet();//{
        const authorization = await getRequestAuthorization(ctx.session);
        if (!authorization.user) throw new AuthorizationError();
        const publicData = db3.createDB3Authorization(authorization.user, authorization.effectivePermissions);
        const u = authorization.user;

        // todo: input validation. it's very important because things are being appended to SQL.

        const table = db3.GetTableById(args.tableID);
        if (!table) {
            throw new Error(`table ${args.tableID} not found`);
        }
        const view = args.viewID ? db3.getDB3View(args.viewID) : undefined;
        if (view && view.tableID !== table.tableID) {
            throw new Error(`DB3 view '${view.viewID}' does not belong to table '${table.tableID}'.`);
        }

        if (!table.authorizeTableForView(publicData)
            || (args.includeDeleted === true && !table.getSearchCapabilities(publicData).includeDeleted)) {
            throw new AuthorizationError();
        }

        // Unlike quick filters, sort and facet columns are explicitly selected
        // by the client. Reject forged requests for columns the caller cannot
        // read instead of silently changing their meaning.
        const isReadableSearchColumn = (columnName: string) => {
            if (!table.getColumn(columnName)) {
                throw new Error(`Search column ${columnName} not found on table ${table.tableName}`);
            }
            return table.authorizeColumnForView({ model: null, publicData, columnName });
        };
        const requireReadableSearchColumn = (columnName: string) => {
            if (!isReadableSearchColumn(columnName)) {
                throw new AuthorizationError();
            }
        };
        args.sort.forEach(sort => requireReadableSearchColumn(sort.db3Column));
        const readableDiscreteCriteria = args.discreteCriteria.filter(criterion => {
            if (isReadableSearchColumn(criterion.db3Column)) {
                return true;
            }
            // Search pages submit disabled criteria as alwaysMatch. They carry
            // no filtering intent and must not produce unauthorized facets.
            if (criterion.behavior === DiscreteCriterionFilterType.alwaysMatch) return false;
            throw new AuthorizationError();
        });
        const resolvedDiscreteCriteria = await resolveSearchDiscreteCriteria(
            table,
            readableDiscreteCriteria,
            publicData,
            database,
        );
        const authorizedSearchArgs = { ...args, discreteCriteria: resolvedDiscreteCriteria };

        const sortElements = processSearchSortModel(table, authorizedSearchArgs);
        const bandTimeZone = await loadBandTimeZone(database);
        const calendarPredicate = args.calendarWindow ? calendarWindowSql(args.calendarWindow, bandTimeZone) : null;

        const filterResult = calculateFilterQuery(u, authorizedSearchArgs, null, sortElements, publicData, calendarPredicate);
        ret.filterQueryResult = filterResult;

        const queries: Promise<any>[] = [];

        for (let i = 0; i < authorizedSearchArgs.discreteCriteria.length; ++i) {
            const criterion = authorizedSearchArgs.discreteCriteria[i]!;
            const col = table.getColumn(criterion.db3Column);
            if (!col) {
                throw new Error(`Column ${criterion.db3Column} wasn't found on table ${table.tableName} / ID:${table.tableID}; unable to form the search query.`);
            }

            const filterResult2 = calculateFilterQuery(u, authorizedSearchArgs, col.member, sortElements, publicData, calendarPredicate);

            const facetInfoQuery = col.SqlGetFacetInfoQuery(u, filterResult.sqlSelect, filterResult2.sqlSelect, criterion);
            // no facet info to be done on this column
            if (!facetInfoQuery) continue;

            const proc = async () => {
                const sw = new Stopwatch();
                const result: TAnyModel[] = await database.$queryRaw(Prisma.raw(facetInfoQuery.sql));
                const tr = result.map(r => facetInfoQuery.transformResult(r));
                ret.facets.push({
                    db3Column: criterion.db3Column,
                    items: tr,
                });
                ret.queryMetrics.push({
                    title: `[${col.member}] facet info`,
                    millis: sw.ElapsedMillis,
                    query: facetInfoQuery.sql,
                    rowCount: tr.length,
                });
            };

            queries.push(proc());
        }

        // query paginated
        let resultIds: number[] = [];
        const paginatedQueryProc = async () => {
            const sw = new Stopwatch();
            // const orderByCol = table.getColumn(args.orderByDb3Column);
            // if (!orderByCol) {
            //     throw new Error(`Order by column ${args.orderByDb3Column} not found on table ${table.tableName}`);
            // }

            const orderBy: string[] = [];
            sortElements.select.forEach(s => {
                orderBy.push(`${s.alias} ${s.direction}`);
            });

            const paginatedResultQuery = `
                    with FilteredItems as (
                        ${filterResult.sqlSelect}
                    )
                    select
                        id
                    from
                        FilteredItems
                    order by
                        ${orderBy.join(`,\n`)}
                    limit
                        ${args.offset},${args.take}
                        `;

            const r: { id: number }[] = await database.$queryRaw(Prisma.raw(paginatedResultQuery));
            resultIds = r.map(x => x.id);
            ret.queryMetrics.push({
                title: `paginated results`,
                millis: sw.ElapsedMillis,
                query: paginatedResultQuery,
                rowCount: r.length,
            });
        };
        queries.push(paginatedQueryProc());

        // TOTAL filtered row count (basically the special "self" facet)
        const totalRowCountQueryProc = async () => {
            const sw = new Stopwatch();
            const totalRowCountQuery = `
                with FilteredItems as (
                    ${filterResult.sqlSelect}
                )
                select
                    count(*) as rowCount
                from
                    FilteredItems
                    `;
            const rowCountResult: [{ rowCount: bigint }] = await database.$queryRaw(Prisma.raw(totalRowCountQuery));
            ret.rowCount = (new Number(rowCountResult[0].rowCount)).valueOf();
            ret.queryMetrics.push({
                title: "total row count",
                millis: sw.ElapsedMillis,
                query: totalRowCountQuery,
                rowCount: 1,
            });
        };

        queries.push(totalRowCountQueryProc());

        const parallelsw = new Stopwatch();
        await Promise.all(queries);
        ret.queryMetrics.push({
            title: "parallel execution",
            millis: parallelsw.ElapsedMillis,
            query: "",
            rowCount: 0,
        });

        // FULL DETAILS USING DB3.
        if (resultIds.length) {
            const queryResult = await queryTable({
                cmdbQueryContext: `getSearchResults[${table.tableName}]`,
                table: {
                    tableID: table.tableID,
                    tableName: table.tableName,
                    viewID: view?.viewID,
                },
                includeDeleted: args.includeDeleted === true,
                filter: {
                    items: [],
                },
                orderBy: undefined,
            },
                authorization,
                database,
                {
                    orderedPrimaryKeys: resultIds,
                    trustedNaturalPrimaryKeys: resultIds,
                });
            ret.queryMetrics.push({
                title: view ? `db3 view items [${view.viewID}]` : "db3 legacy items",
                millis: queryResult.executionTimeMillis,
                query: "",
                rowCount: queryResult.items.length,
            });

            ret.results = queryResult.items;
        }

        ret.queryMetrics.push({
            title: "(root)",
            millis: rootsw.ElapsedMillis,
            query: "",
            rowCount: 0,
        });

        return ret;
    } catch (e) {
        console.error(e);
        throw (e);
    }
}
