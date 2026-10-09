import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";
import { AuthorizationError } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { ZGetSearchResultsInput, MakeEmptySearchResultsRet, type SearchResultsFacet, type SearchQueryMetric } from "../shared/apiTypes";
import { executeDB3Read, type DB3ReadContext, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryTable } from "./db3QueryCore";
import { calendarWindowSql } from "./calendarWindowSql";
import { resolveSearchFacetLabels } from "./searchFacetCatalogs";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
// generalized version of search results.
// hopefully can unify song & event search, and then extend to users & files.

import { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
import { SqlCombineAndExpression, SqlCombineOrExpression } from "shared/mysqlUtils";
import { SplitQuickFilter } from "shared/quickFilter";
import { CalculateFilterQueryResult, type DiscreteCriterion, DiscreteCriterionFilterType, GetSearchResultsInput, SearchResultsRet, SortQueryElements } from "src/core/db3/shared/apiTypes";
import * as db3 from "../../../core/db3/db3";
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
    auth: CMServerAuthorization,
    database: TransactionalPrismaClient,
): Promise<DiscreteCriterion[]> {
    return Promise.all(criteria.map(async criterion => {
        const column = table.getColumn(criterion.db3Column);
        if (!column) {
            throw new Error(`Search column ${criterion.db3Column} not found on table ${table.tableName}`);
        }
        const targetTable = column.getDiscreteCriterionTargetTable();
        if (!targetTable?.publicIdMember) {
            return criterion;
        }
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
                auth,
                database,
            ),
        };
    }));
}

// construct a SQL select clause returning filtered items.
// no pagination or sorting applied yet
function calculateFilterQuery(
    //currentUser: UserWithRolesPayload,
    args: GetSearchResultsInput,
    excludeCriterionColumn: string | null,
    sortElements: SortQueryElements,
    auth: CMServerAuthorization,
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
        if (table.tableName !== "Event") {
            throw new Error("Calendar windows are only supported for event searches.");
        }
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
                auth,
                columnName: column.member,
            })) {
                continue;
            }
            const orExpr = column.SqlGetQuickFilterElementsForToken(token, qfTokens);
            if (orExpr === null) {
                continue;
            }
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
        const elements = col.SqlGetDiscreteCriterionElements(criterion, "P", auth);
        // no filtering to be done on this column
        if (!elements) {
            continue;
        }

        if (!!elements.error) {
            result.errors.push({
                column: criterion.db3Column,
                error: elements.error,
            });
            // Keep the reference UI's unselected-filter behavior while showing its guidance.
            continue;
        }

        // integrate elements
        whereAnd.push(elements.whereAnd);
    }

    whereAnd.push(table.SqlGetVisFilterExpression({ tableAlias: "P", includeDeleted: args.includeDeleted, auth }));

    const ret: string = `
        SELECT
            P.${table.pkMember} id,
            P.${table.publicIdMember} publicId,
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

export class SearchInputError extends Error { }

const searchDomains = [
    {
        table: db3.xEvent,
        view: db3.eventSearchView,
        permission: Permission.view_events_nonpublic,
        // TODO: these should be well-typed such that a misspelled symbol
        // would fail to compile!
        sorts: ["name", "startsAt"],
        criteria: ["startsAt", "type", "status", "tags"],
    },
    {
        table: db3.xSong,
        view: db3.songSearchView,
        permission: Permission.view_songs,
        // TODO: these should be well-typed such that a misspelled symbol
        // would fail to compile!
        sorts: ["name", "startBPM", "introducedYear", "lengthSeconds"],
        criteria: ["tags"]
    },
];

function requireSearchDomain(tableID: string) {
    const domain = searchDomains.find(domain => domain.table.tableID.toLowerCase() === tableID.toLowerCase());
    if (!domain) {
        return requireRestoredApplicationFeature("domainSearch");
    }
    return domain;
}

export async function GetSearchResultsCore(input: GetSearchResultsInput, authorization: CMServerAuthorization,
    database: DB3ReadDatabase = db,
): Promise<SearchResultsRet> {
    // Each domain is reopened only when its query and transport owners are migrated.
    requireSearchDomain(input.tableID);
    const args = ZGetSearchResultsInput.parse(input);
    return executeDB3Read(database, authorization, context => searchInSnapshot(args, context));
}

function authorizeSearch(args: GetSearchResultsInput, auth: CMServerAuthorization): DiscreteCriterion[] {
    const domain = requireSearchDomain(args.tableID);
    auth.requireUser();
    auth.requirePermission(domain.permission);
    if (args.bandPublicId !== auth.requireBand().publicId || args.includeDeleted === true) {
        throw new AuthorizationError();
    }
    if (args.viewID && args.viewID !== domain.view.viewID) {
        throw new SearchInputError(`Search requires the ${domain.view.viewID} view.`);
    }
    const table: db3.xTable = domain.table;
    if (!table.authorizeTableForView(auth)) {
        throw new AuthorizationError();
    }
    const requireReadableColumn = (columnName: string) => {
        if (!table.getColumn(columnName)) {
            throw new SearchInputError(`Unknown search column ${columnName}.`);
        }
        if (!table.authorizeColumnForView({ model: null, auth, columnName })) {
            throw new AuthorizationError();
        }
    };
    for (const sort of args.sort) {
        requireReadableColumn(sort.db3Column);
        if (!domain.sorts.includes(sort.db3Column)) {
            throw new SearchInputError(`Unsupported search sort ${sort.db3Column}.`);
        }
    }
    return args.discreteCriteria.filter(criterion => {
        if (criterion.behavior === DiscreteCriterionFilterType.alwaysMatch
            && !table.authorizeColumnForView({ model: null, auth, columnName: criterion.db3Column })) {
            return false;
        }
        requireReadableColumn(criterion.db3Column);
        if (!domain.criteria.includes(criterion.db3Column)) {
            throw new SearchInputError(`Unsupported search criterion ${criterion.db3Column}.`);
        }
        return true;
    });
}

interface SearchExecution {
    readonly context: DB3ReadContext;
    readonly domain: ReturnType<typeof requireSearchDomain>;
    readonly args: GetSearchResultsInput;
    readonly sort: SortQueryElements;
    readonly calendarPredicate: string | null;
    readonly filter: CalculateFilterQueryResult;
    readonly metrics: SearchQueryMetric[];
}

async function prepareSearch(args: GetSearchResultsInput, context: DB3ReadContext): Promise<SearchExecution> {
    const auth = context.authorization;
    const domain = requireSearchDomain(args.tableID);
    const criteria = authorizeSearch(args, auth);
    const discreteCriteria = await resolveSearchDiscreteCriteria(domain.table, criteria, auth, context.database);
    const searchArgs = { ...args, discreteCriteria };
    const sort = processSearchSortModel(domain.table, searchArgs);
    const calendarPredicate = args.calendarWindow
        ? calendarWindowSql(args.calendarWindow, await loadBandTimeZone(context.database, auth.requireBand().id)) : null;
    const filter = calculateFilterQuery(searchArgs, null, sort, auth, calendarPredicate);
    return { context, domain, args: searchArgs, sort, calendarPredicate, filter, metrics: [] };
}

async function querySearchRows<T>(search: SearchExecution, title: string, sql: string): Promise<T[]> {
    const start = Date.now();
    const rows = await search.context.database.$queryRaw<T[]>(Prisma.raw(sql));
    search.metrics.push({ title, query: sql, millis: Date.now() - start, rowCount: rows.length });
    return rows;
}

async function loadSearchFacet(search: SearchExecution, criterion: DiscreteCriterion): Promise<SearchResultsFacet | null> {
    const { args, sort, context, filter, calendarPredicate } = search;
    const auth = context.authorization;
    const table: db3.xTable = search.domain.table;
    const field = table.getColumn(criterion.db3Column)!;
    const excluding = calculateFilterQuery(args, field.member, sort, auth, calendarPredicate);
    const facet = field.SqlGetFacetInfoQuery({
        auth, crit: criterion,
        filteredItemsQuery: filter.sqlSelect,
        filteredItemsQueryExcludingThisCriterion: excluding.sqlSelect
    });
    if (!facet) {
        return null;
    }
    // Facet row shapes belong to the field that generated this SQL and transforms each row.
    const rows = await querySearchRows<object>(search, `${field.member} facet info`, facet.sql);
    const items = await resolveSearchFacetLabels(field.getDiscreteCriterionTargetTable(), rows.map(row => facet.transformResult(row)), context, args);
    return { db3Column: field.member, items };
}

async function loadSearchFacets(search: SearchExecution): Promise<SearchResultsFacet[]> {
    const facets = await Promise.all(search.args.discreteCriteria.map(criterion => loadSearchFacet(search, criterion)));
    return facets.filter((facet): facet is SearchResultsFacet => facet !== null);
}

async function loadSearchPageIds(search: SearchExecution): Promise<number[]> {
    const { args, sort, filter } = search;
    // Public identities break semantic-sort ties without exposing database primary keys.
    const orderBy = [...sort.select.map(item => `${item.alias} ${item.direction}`), "publicId asc"].join(", ");
    const rows = await querySearchRows<{ id: number }>(search, "paginated results",
        `WITH FilteredItems AS (${filter.sqlSelect}) SELECT id FROM FilteredItems ORDER BY ${orderBy} LIMIT ${args.offset},${args.take}`);
    return rows.map(row => row.id);
}

async function loadSearchCount(search: SearchExecution): Promise<number> {
    const rows = await querySearchRows<{ rowCount: bigint }>(search, "total row count",
        `WITH FilteredItems AS (${search.filter.sqlSelect}) SELECT count(*) rowCount FROM FilteredItems`);
    return Number(rows[0]?.rowCount ?? 0);
}

async function loadSearchPage(search: SearchExecution, primaryKeys: number[]): Promise<SearchResultsRet["results"]> {
    if (!primaryKeys.length) {
        return [];
    }
    const { args, context, domain } = search;
    const rows = await queryTable({
        table: {
            tableID: domain.table.tableID,
            tableName: domain.table.tableName,
            viewID: domain.view.viewID
        },
        bandPublicId: args.bandPublicId,
        routeLocale: args.routeLocale,
        browserLanguages: args.browserLanguages,
        filter: {},
        orderBy: undefined,
        cmdbQueryContext: "domain search results",
    }, context.authorization, context, { orderedPrimaryKeys: primaryKeys, trustedNaturalPrimaryKeys: primaryKeys });
    search.metrics.push({ title: `DB3 ${domain.view.viewID} items`, millis: rows.executionTimeMillis, query: "", rowCount: rows.items.length });
    return rows.items;
}

async function searchInSnapshot(args: GetSearchResultsInput, context: DB3ReadContext): Promise<SearchResultsRet> {
    const sw = new Stopwatch();
    const search = await prepareSearch(args, context);
    const [facets, ids, rowCount] = await Promise.all([
        loadSearchFacets(search), loadSearchPageIds(search), loadSearchCount(search),
    ]);
    const results = await loadSearchPage(search, ids);
    search.metrics.push({ title: "(root)", millis: sw.ElapsedMillis, query: "", rowCount: results.length });
    // Diagnostic SQL authorization uses the fresh snapshot, including for direct callers.
    const canSeeSql = context.authorization.hasPermission(Permission.sysadmin);
    return {
        ...MakeEmptySearchResultsRet(), rowCount, results, facets,
        filterQueryResult: { ...search.filter, sqlSelect: canSeeSql ? search.filter.sqlSelect : "" },
        queryMetrics: search.metrics.map(metric => ({ ...metric, query: canSeeSql ? metric.query : "" })),
    };
}

// MIGRATION_RESTORE: domain-search
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/db3/server/searchServerCore.ts:196-420
// Reason: The raw domain search owner does not establish a selected-band authorization snapshot for its SQL.
// Restore: Restore the domain search HTTP/direct owner with explicit band snapshots, authorized localized predicates/facets, consistent counts/paging/order, public identities and contextual links; account for preserved event/song and directory semantics.
// Verification: Reactivate preserved search authorization/recovery specifications; verify anonymous/member/admin visibility, two bands/locales, hidden assignments, all filter operators, grant revocation, facets and built-browser search.
// SHA256: 77b8e2cfdffe5578e9e66b6afd00879c808748dddc734b82740dec493e49ee49
// MIGRATION_REFERENCE_BEGIN
// export async function GetSearchResultsCore(args: GetSearchResultsInput, auth: CMServerAuthorization): Promise<SearchResultsRet> {
//     if (!args.calendarWindow) return getSearchResults(args, auth, db);
//     return db.$transaction(tx => getSearchResults(args, auth, tx), {
//         isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000,
//     });
// }
//
// async function getSearchResults(args: GetSearchResultsInput, auth: CMServerAuthorization, database: TransactionalPrismaClient): Promise<SearchResultsRet> {
//     try {
//         const rootsw = new Stopwatch();
//         const ret: SearchResultsRet = MakeEmptySearchResultsRet();//{
//
//         // todo: input validation. it's very important because things are being appended to SQL.
//
//         const table = db3.GetTableById(args.tableID);
//         if (!table) {
//             throw new Error(`table ${args.tableID} not found`);
//         }
//         const view = args.viewID ? db3.getDB3View(args.viewID) : undefined;
//         if (view && view.tableID !== table.tableID) {
//             throw new Error(`DB3 view '${view.viewID}' does not belong to table '${table.tableID}'.`);
//         }
//
//         if (!table.authorizeTableForView(auth)
//             || (args.includeDeleted === true && !table.getSearchCapabilities(auth).includeDeleted)) {
//             throw new AuthorizationError();
//         }
//
//         // Unlike quick filters, sort and facet columns are explicitly selected
//         // by the client. Reject forged requests for columns the caller cannot
//         // read instead of silently changing their meaning.
//         const isReadableSearchColumn = (columnName: string) => {
//             if (!table.getColumn(columnName)) {
//                 throw new Error(`Search column ${columnName} not found on table ${table.tableName}`);
//             }
//             return table.authorizeColumnForView({ model: null, auth, columnName });
//         };
//         const requireReadableSearchColumn = (columnName: string) => {
//             if (!isReadableSearchColumn(columnName)) {
//                 throw new AuthorizationError();
//             }
//         };
//         args.sort.forEach(sort => requireReadableSearchColumn(sort.db3Column));
//         const readableDiscreteCriteria = args.discreteCriteria.filter(criterion => {
//             if (isReadableSearchColumn(criterion.db3Column)) {
//                 return true;
//             }
//             // Search pages submit disabled criteria as alwaysMatch. They carry
//             // no filtering intent and must not produce unauthorized facets.
//             if (criterion.behavior === DiscreteCriterionFilterType.alwaysMatch) return false;
//             throw new AuthorizationError();
//         });
//         const resolvedDiscreteCriteria = await resolveSearchDiscreteCriteria(
//             table,
//             readableDiscreteCriteria,
//             auth,
//             database,
//         );
//         const authorizedSearchArgs = { ...args, discreteCriteria: resolvedDiscreteCriteria };
//
//         const sortElements = processSearchSortModel(table, authorizedSearchArgs);
//         const bandTimeZone = auth.band ? await loadBandTimeZone(database, auth.band.id) : DEFAULT_BAND_TIME_ZONE;
//         const calendarPredicate = args.calendarWindow ? calendarWindowSql(args.calendarWindow, bandTimeZone) : null;
//
//         const filterResult = calculateFilterQuery(authorizedSearchArgs, null, sortElements, auth, calendarPredicate);
//         ret.filterQueryResult = filterResult;
//
//         const queries: Promise<any>[] = [];
//
//         for (let i = 0; i < authorizedSearchArgs.discreteCriteria.length; ++i) {
//             const criterion = authorizedSearchArgs.discreteCriteria[i]!;
//             const col = table.getColumn(criterion.db3Column);
//             if (!col) {
//                 throw new Error(`Column ${criterion.db3Column} wasn't found on table ${table.tableName} / ID:${table.tableID}; unable to form the search query.`);
//             }
//
//             const filterResult2 = calculateFilterQuery(authorizedSearchArgs, col.member, sortElements, auth, calendarPredicate);
//
//             const facetInfoQuery = col.SqlGetFacetInfoQuery({
//                 auth,
//                 filteredItemsQuery: filterResult.sqlSelect,
//                 filteredItemsQueryExcludingThisCriterion: filterResult2.sqlSelect,
//                 crit: criterion,
//             });
//
//             // no facet info to be done on this column
//             if (!facetInfoQuery) continue;
//
//             const proc = async () => {
//                 const sw = new Stopwatch();
//                 const result: TAnyModel[] = await database.$queryRaw(Prisma.raw(facetInfoQuery.sql));
//                 const tr = result.map(r => facetInfoQuery.transformResult(r));
//                 ret.facets.push({
//                     db3Column: criterion.db3Column,
//                     items: tr,
//                 });
//                 ret.queryMetrics.push({
//                     title: `[${col.member}] facet info`,
//                     millis: sw.ElapsedMillis,
//                     query: facetInfoQuery.sql,
//                     rowCount: tr.length,
//                 });
//             };
//
//             queries.push(proc());
//         }
//
//         // query paginated
//         let resultIds: number[] = [];
//         const paginatedQueryProc = async () => {
//             const sw = new Stopwatch();
//             // const orderByCol = table.getColumn(args.orderByDb3Column);
//             // if (!orderByCol) {
//             //     throw new Error(`Order by column ${args.orderByDb3Column} not found on table ${table.tableName}`);
//             // }
//
//             const orderBy: string[] = [];
//             sortElements.select.forEach(s => {
//                 orderBy.push(`${s.alias} ${s.direction}`);
//             });
//
//             const paginatedResultQuery = `
//                     with FilteredItems as (
//                         ${filterResult.sqlSelect}
//                     )
//                     select
//                         id
//                     from
//                         FilteredItems
//                     order by
//                         ${orderBy.join(`,\n`)}
//                     limit
//                         ${args.offset},${args.take}
//                         `;
//
//             const r: { id: number }[] = await database.$queryRaw(Prisma.raw(paginatedResultQuery));
//             resultIds = r.map(x => x.id);
//             ret.queryMetrics.push({
//                 title: `paginated results`,
//                 millis: sw.ElapsedMillis,
//                 query: paginatedResultQuery,
//                 rowCount: r.length,
//             });
//         };
//         queries.push(paginatedQueryProc());
//
//         // TOTAL filtered row count (basically the special "self" facet)
//         const totalRowCountQueryProc = async () => {
//             const sw = new Stopwatch();
//             const totalRowCountQuery = `
//                 with FilteredItems as (
//                     ${filterResult.sqlSelect}
//                 )
//                 select
//                     count(*) as rowCount
//                 from
//                     FilteredItems
//                     `;
//             const rowCountResult: [{ rowCount: bigint }] = await database.$queryRaw(Prisma.raw(totalRowCountQuery));
//             ret.rowCount = (new Number(rowCountResult[0].rowCount)).valueOf();
//             ret.queryMetrics.push({
//                 title: "total row count",
//                 millis: sw.ElapsedMillis,
//                 query: totalRowCountQuery,
//                 rowCount: 1,
//             });
//         };
//
//         queries.push(totalRowCountQueryProc());
//
//         const parallelsw = new Stopwatch();
//         await Promise.all(queries);
//         ret.queryMetrics.push({
//             title: "parallel execution",
//             millis: parallelsw.ElapsedMillis,
//             query: "",
//             rowCount: 0,
//         });
//
//         // FULL DETAILS USING DB3.
//         if (resultIds.length) {
//             const queryResult = await queryTable(
//                 {
//                     cmdbQueryContext: `getSearchResults[${table.tableName}]`,
//                     table: {
//                         tableID: table.tableID,
//                         tableName: table.tableName,
//                         viewID: view?.viewID,
//                     },
//                     includeDeleted: args.includeDeleted === true,
//                     filter: {
//                         items: [],
//                     },
//                     orderBy: undefined,
//                 },
//                 auth,
//                 database,
//                 {
//                     orderedPrimaryKeys: resultIds,
//                     trustedNaturalPrimaryKeys: resultIds,
//                 }
//             );
//             ret.queryMetrics.push({
//                 title: view ? `db3 view items [${view.viewID}]` : "db3 legacy items",
//                 millis: queryResult.executionTimeMillis,
//                 query: "",
//                 rowCount: queryResult.items.length,
//             });
//
//             ret.results = queryResult.items;
//         }
//
//         ret.queryMetrics.push({
//             title: "(root)",
//             millis: rootsw.ElapsedMillis,
//             query: "",
//             rowCount: 0,
//         });
//
//         return ret;
//     } catch (e) {
//         console.error(e);
//         throw (e);
//     }
// }
// MIGRATION_REFERENCE_END
