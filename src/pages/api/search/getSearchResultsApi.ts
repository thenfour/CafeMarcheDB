// generalized version of search results.
// hopefully can unify song & event search, and then extend to users & files.

import { Ctx } from "@blitzjs/next";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";
import { api } from "src/blitz-server";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { DB3QueryCore2 } from "src/core/db3/server/db3QueryCore";
import { CalculateFilterQueryResult, GetSearchResultsInput, MakeEmptySearchResultsRet, SearchCustomDataHookId, SearchResultsRet, SortQueryElements, TAnyModel, ZGetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import superjson from "superjson";
import * as db3 from "../../../core/db3/db3";
import { SplitQuickFilter } from "shared/quickFilter";
import { SqlCombineAndExpression, SqlCombineOrExpression } from "shared/mysqlUtils";

async function GetCustomSearchResultsHook(currentUser: db3.UserWithRolesPayload, inp: GetSearchResultsInput, resultsSoFar: SearchResultsRet): Promise<db3.EventSearchCustomData> {
    const fullEvents = resultsSoFar.results as db3.EventSearch_Event[];

    // collect distinct usertags
    const expectedAttendanceUserTagIds = new Set<number>();
    fullEvents.forEach(e => {
        if (!e.expectedAttendanceUserTagId) return;
        expectedAttendanceUserTagIds.add(e.expectedAttendanceUserTagId);
    });

    let userTags: db3.EventResponses_ExpectedUserTag[] = [];

    if (!expectedAttendanceUserTagIds.size) {
        return {
            userTags: []
        };
    }
    const tableParams: db3.UserTagTableParams = {
        ids: [...expectedAttendanceUserTagIds],
    };

    const queryResult = await DB3QueryCore2({
        clientIntention: { intention: "user", currentUser, mode: "primary" },
        cmdbQueryContext: "getEventFilterInfo-userTags",
        tableID: db3.xUserTagForEventSearch.tableID,
        tableName: db3.xUserTagForEventSearch.tableName,
        filter: {
            items: [],
            tableParams,
        },
        orderBy: undefined,
    }, currentUser);

    userTags = queryResult.items as db3.EventResponses_ExpectedUserTag[];
    return {
        userTags,
    };
};


type CustomSearchHookProc = (currentUser: db3.UserWithRolesPayload, inp: GetSearchResultsInput, resultsSoFar: SearchResultsRet) => Promise<any>;

const gSearchCustomHookMap: { [key in SearchCustomDataHookId]: CustomSearchHookProc } = {
    "Events": GetCustomSearchResultsHook,
} as const;



function ProcessSortModel(table: db3.xTable, args: GetSearchResultsInput): SortQueryElements {
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

    // now finally sort by ID to ensure the search results are 100% deterministic.
    // without this, #342 items can return in slightly different order each paginated query,
    // resulting in skipping and incomplete results or mismatch between total rows & total rows returned
    sortElementsArray.push({
        join: [],
        select: [{
            alias: getSortColumnAPI.getColumnAlias(),
            expression: `P.id`,
            direction: "asc",
        }],
    });

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

// construct a SQL select clause returning filtered items.
// no pagination or sorting applied yet
function calculateFilterQuery(currentUser: db3.UserWithRolesPayload, args: GetSearchResultsInput, excludeCriterionColumn: string | null, sortElements: SortQueryElements): CalculateFilterQueryResult {
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

    const qfTokens = SplitQuickFilter(args.quickFilter);
    for (let itok = 0; itok < qfTokens.length; ++itok) {
        const token = qfTokens[itok]!;
        const OR: string[] = [];
        for (let i = 0; i < table.columns.length; ++i) {
            const column = table.columns[i]!;
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

    whereAnd.push(table.SqlGetVisFilterExpression(currentUser, "P"));

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
async function GetSearchResultsCore(args: GetSearchResultsInput, ctx: AuthenticatedCtx): Promise<SearchResultsRet> {
    try {
        const rootsw = new Stopwatch();
        const ret: SearchResultsRet = MakeEmptySearchResultsRet();//{
        const u = (await mutationCore.getCurrentUserCore(ctx))!;
        if (!u.role || u.role.permissions.length < 1) {
            return ret;
        }

        // todo: input validation. it's very important because things are being appended to SQL.

        const table = db3.GetTableById(args.tableID);
        if (!table) {
            throw new Error(`table ${args.tableID} not found`);
        }

        const sortElements = ProcessSortModel(table, args);

        const filterResult = calculateFilterQuery(u, args, null, sortElements);
        ret.filterQueryResult = filterResult;

        const queries: Promise<any>[] = [];

        for (let i = 0; i < args.discreteCriteria.length; ++i) {
            const criterion = args.discreteCriteria[i]!;
            const col = table.getColumn(criterion.db3Column);
            if (!col) {
                throw new Error(`Column ${criterion.db3Column} wasn't found on table ${table.tableName} / ID:${table.tableID}; unable to form the search query.`);
            }

            const filterResult2 = calculateFilterQuery(u, args, col.member, sortElements);

            const facetInfoQuery = col.SqlGetFacetInfoQuery(u, filterResult.sqlSelect, filterResult2.sqlSelect, criterion);
            // no facet info to be done on this column
            if (!facetInfoQuery) continue;

            const proc = async () => {
                const sw = new Stopwatch();
                const result: TAnyModel[] = await db.$queryRaw(Prisma.raw(facetInfoQuery.sql));
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

            const r: { id: number }[] = await db.$queryRaw(Prisma.raw(paginatedResultQuery));
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
            const rowCountResult: [{ rowCount: bigint }] = await db.$queryRaw(Prisma.raw(totalRowCountQuery));
            ret.rowCount = (new Number(rowCountResult[0].rowCount)).valueOf();
            ret.queryMetrics.push({
                title: "total row count",
                millis: sw.ElapsedMillis,
                query: totalRowCountQuery,
                rowCount: 1,
            });
        };

        queries.push(totalRowCountQueryProc());

        // // TOTAL filtered row IDs (for debugging purposes)
        // const allFilteredIdsQueryProc = async () => {
        //     const sw = new Stopwatch();
        //     const orderBy: string[] = [];
        //     sortElements.select.forEach(s => {
        //         orderBy.push(`${s.alias} ${s.direction}`);
        //     });

        //     const query = `
        //         with FilteredItems as (
        //             ${filterResult.sqlSelect}
        //         )
        //         select
        //             id
        //         from
        //             FilteredItems
        //         order by
        //             ${orderBy.join(`,\n`)}
        //             `;
        //     const r: { id: bigint }[] = await db.$queryRaw(Prisma.raw(query));
        //     //ret.rowCount = (new Number(rowCountResult[0].rowCount)).valueOf();
        //     ret.queryMetrics.push({
        //         title: "all row IDs in order",
        //         millis: sw.ElapsedMillis,
        //         query,
        //         rowCount: r.length,
        //     });
        //     ret.allIdsInOrder = r.map(x => BigintToNumber(x.id));
        // };

        // queries.push(allFilteredIdsQueryProc());

        const parallelsw = new Stopwatch();
        await Promise.all(queries);
        ret.queryMetrics.push({
            title: "parallel execution",
            millis: parallelsw.ElapsedMillis,
            query: "",
            rowCount: 0,
        });

        // FULL EVENT DETAILS USING DB3.
        if (resultIds.length) {
            const queryResult = await DB3QueryCore2({
                clientIntention: { intention: "user", currentUser: u, mode: "primary" },
                cmdbQueryContext: `getSearchResults[${table.tableName}]`,
                tableID: table.tableID,
                tableName: table.tableName,
                filter: {
                    items: [],
                    pks: resultIds,
                },
                orderBy: undefined,
            }, u);
            ret.queryMetrics.push({
                title: "db3 verbose items",
                millis: queryResult.executionTimeMillis,
                query: "",
                rowCount: queryResult.items.length,
            });

            // apply sorting to make sure the page looks correct.
            // the filter *should* be unnecessary but some edge cases (race conditions) could result in mismatches so play safe.
            ret.results = resultIds.map(id => queryResult.items.find(r => r[table.pkMember] === id)).filter(r => !!r);
        }

        if (table.SearchCustomDataHookId) {
            const hooksw = new Stopwatch();
            const proc = gSearchCustomHookMap[table.SearchCustomDataHookId];
            ret.customData = await proc(u, args, ret);
            ret.queryMetrics.push({
                title: `Custom hook: [${table.SearchCustomDataHookId}]`,
                millis: hooksw.ElapsedMillis,
                query: "",
                rowCount: 0,
            });
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

export default api(async (req, res, ctx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            const currentUser = await mutationCore.getCurrentUserCore(ctx);
            const authenticatedCtx = mutationCore.getAuthenticatedCtx(ctx, Permission.visibility_members);
            if (!currentUser || !authenticatedCtx) throw new Error(`unauthorized`);

            const argsStr = req.query.args;
            if (typeof (argsStr) !== 'string') throw new Error(`invalid args`);
            const parsedargs = superjson.parse(argsStr);
            const validatedArgs = ZGetSearchResultsInput.parse(parsedargs);

            const result = await GetSearchResultsCore(validatedArgs, authenticatedCtx);
            res.status(200).send(superjson.serialize(result));
        } catch (error) {
            console.error("Failed to fetch search results", error);
            res.status(500).json({ error: "Failed to fetch data" });
        }
    }); // return new promise
});





