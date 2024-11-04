'use client';

// so originally this started as a general API (hence the "capabilities" bitfield). but it's really just geared towards datagrids.
// for a more conventional "client side API" look at clientAPI.tsx et al.

// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import { RestPaginatedResult, RestQueryResult, useMutation, usePaginatedQuery, useQuery } from "@blitzjs/rpc";
import React from "react";
//import * as db3 from "../db3";
import { GridColDef, GridPaginationModel, GridSortModel } from "@mui/x-data-grid";
import { assert } from "blitz";
import { Coalesce, HasFlag, SettingKey, gQueryOptions } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { GenerateDefaultDescriptionSettingName, SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import db3queries from "../queries/db3queries";
import { CMDBTableFilterModel, TAnyModel } from "../shared/apiTypes";


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface NewDialogAPI {
    // call like, params.api.setFieldValues({ [this.columnName]: val });
    setFieldValues: (fieldValues: { [key: string]: any }) => void,
};

export interface RenderForNewItemDialogArgs {
    key: any;
    row: TAnyModel; // row
    value: unknown;
    validationResult?: db3.ValidateAndComputeDiffResult;
    api: NewDialogAPI,
    clientIntention: db3.xTableClientUsageContext;
    autoFocus: boolean; // should the renderer set focus on mount?
};

export interface RenderViewerArgs<T> {
    key: any;
    row: TAnyModel; // row
    value: T;
    className?: string;
};

export interface IColumnClientArgs {
    // NB: keep IColumnClient in sync with these fields.
    columnName: string;
    headerName: string;
    editable: boolean;
    visible: boolean;
    width: number;
    isAutoFocusable: boolean;

    fieldCaption: string | undefined;
    fieldDescriptionSettingName: string | null | undefined;
    className: string | undefined;

    GridColProps?: Partial<GridColDef>;
};

export abstract class IColumnClient {
    // IColumnClientArgs here...
    columnName: string;
    headerName: string;
    editable: boolean;
    visible: boolean;
    width: number;

    fieldCaption: string | undefined;
    fieldDescriptionSettingName: SettingKey | null | undefined;
    className: string | undefined;

    isAutoFocusable: boolean;

    GridColProps?: Partial<GridColDef>;

    abstract renderForNewDialog?: (params: RenderForNewItemDialogArgs) => React.ReactNode; // will render as a child of <FormControl>
    abstract renderViewer: (params: RenderViewerArgs<unknown>) => React.ReactNode; // will render as a child of <FormControl>
    abstract ApplyClientToPostClient?: (clientRow: TAnyModel, updateModel: TAnyModel, mode: db3.DB3RowMode) => void; // applies the values from the client object to a db-compatible object.
    abstract onSchemaConnected(tableClient: xTableRenderClient<any>): void;

    schemaTable: db3.xTable;
    schemaColumn: db3.FieldBase<unknown>;

    constructor(args: IColumnClientArgs) {
        Object.assign(this, args);
        // safety.
        assert(this.visible !== undefined, "visible is required; maybe a column client type forgot to include this in the ctor?");
        this.visible = Coalesce(this.visible, true);
    }

    // called when the table client is initialized to make sure this column object knows about its sibling column in the schema.
    connectColumn = (schemaTable: db3.xTable, tableClient: xTableRenderClient<any>) => {
        console.assert(this.columnName.length > 0);
        this.schemaTable = schemaTable;
        this.schemaColumn = schemaTable.columns.find(c => c.member === this.columnName)!;
        if (!this.schemaColumn) {
            console.error(`column '${schemaTable.tableName}'.'${this.columnName}' doesn't have a corresponding field in the core schema.`);
        }
        this.onSchemaConnected && this.onSchemaConnected(tableClient);
    };

    // child classes call this when you want default rendering.
    defaultRenderer = ({ value, className, isReadOnly, validationResult }: { value: React.ReactNode, className?: string, isReadOnly: boolean, validationResult: undefined | db3.ValidateAndComputeDiffResult }) => {
        const defaultDescriptionSettingName = GenerateDefaultDescriptionSettingName(this.schemaTable.tableName, this.columnName);
        return <NameValuePair
            key={this.columnName} // not 100% accurate but probably 99.99%
            name={this.fieldCaption || this.columnName}
            description={<SettingMarkdown setting={this.fieldDescriptionSettingName || defaultDescriptionSettingName} />}
            value={value}
            fieldName={this.columnName}
            isReadOnly={isReadOnly}
            className={`${className} ${this.className || ""}`}
            validationResult={validationResult}
        />;
    };
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// the class that describes front-end behavior of a model. i.e. a restatement of the db schema, but describing how it translates to GUI.
// this is the client-side analog to xTable.

export interface xTableClientSpecArgs {
    table: db3.xTable;
    columns: IColumnClient[];
};

export class xTableClientSpec {
    args: xTableClientSpecArgs;
    constructor(args: xTableClientSpecArgs) {
        this.args = args;
    };

    getColumn = (name: string): IColumnClient => this.args.columns.find(c => c.columnName === name)!;

    renderViewer = <T extends TAnyModel,>(columnName: string, row: T) => {
        return this.getColumn(columnName).renderViewer({
            row,
            key: columnName,
            value: row[columnName]
        });
    }

    renderEditor = <T extends TAnyModel,>(columnName: string, row: T, validationResult: db3.ValidateAndComputeDiffResult, onChange: (row: T) => void, clientIntention: db3.xTableClientUsageContext, autoFocus: boolean) => {
        const col = this.getColumn(columnName);

        return col.renderForNewDialog && col.renderForNewDialog({
            validationResult,
            autoFocus,
            clientIntention,
            api: {
                setFieldValues: (fieldValues: { [key: string]: any }) => {
                    const newValue = { ...row, ...fieldValues };
                    onChange(newValue);
                },
            },
            row,
            key: columnName,
            value: row[columnName],

        });
    }

};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// xTableRenderClient is an object that React components use to access functionality, access the items in the table etc.

export const CalculateOrderBy = (sortModel?: GridSortModel) => {
    let orderBy: any = undefined;//{id: "asc" }; // default order
    if (sortModel && sortModel.length > 0) {
        orderBy = { [sortModel[0]!.field]: sortModel[0]!.sort }; // only support 1 ordering (grid does too afaik)
    }
    return orderBy;
};

export type TMutateFn = (args: db3.MutatorInput) => Promise<unknown>;

export enum xTableClientCaps {
    None = 0,
    PaginatedQuery = 1,
    Query = 2,
    Mutation = 4,
};

export interface xTableClientArgs {
    tableSpec: xTableClientSpec,

    requestedCaps: xTableClientCaps,
    clientIntention: db3.xTableClientUsageContext;

    // optional for example for new item dialog which doesn't do any querying at all.
    sortModel?: GridSortModel,
    filterModel?: CMDBTableFilterModel,
    paginationModel?: GridPaginationModel,

    queryOptions?: any; // of gQueryOptions
};

export class xTableRenderClient<Trow extends TAnyModel = TAnyModel> {
    tableSpec: xTableClientSpec;
    args: xTableClientArgs;
    mutateFn: TMutateFn;

    items: Trow[];
    rowCount: number;
    remainingQueryResults: any;
    remainingQueryStatus: RestQueryResult<unknown, unknown>;
    remainingPaginatedQueryStatus: RestPaginatedResult<unknown, unknown>;

    // after a query, this gets populated.
    queryResultInfo: {
        executionTimeMillis: number,
        resultId: string,
        //resultPayloadSize: number,
    };

    refetch: () => void;

    get schema() {
        return this.tableSpec.args.table;
    }
    get clientColumns() {
        return this.tableSpec.args.columns;
    }

    getColumn(name: string) {
        return this.tableSpec.getColumn(name);
    }

    constructor(args: xTableClientArgs) {
        this.tableSpec = args.tableSpec;
        this.args = args;
        this.queryResultInfo = {
            executionTimeMillis: 0,
            resultId: "",
            //resultPayloadSize: 0,
        };

        const [currentUser] = useCurrentUser();
        if (currentUser != null) {
            args.clientIntention.currentUser = currentUser;
        }

        if (HasFlag(args.requestedCaps, xTableClientCaps.Mutation)) {
            this.mutateFn = useMutation(db3mutations)[0] as TMutateFn;
        }

        const orderBy = CalculateOrderBy(args.sortModel);

        const skip = !!args.paginationModel ? (args.paginationModel.pageSize * args.paginationModel.page) : undefined;
        const take = !!args.paginationModel ? (args.paginationModel.pageSize) : undefined;

        for (let i = 0; i < this.clientColumns.length; ++i) {
            this.clientColumns[i]?.connectColumn(args.tableSpec.args.table, this);
        }

        let items_: Trow[] = [];

        const filter: CMDBTableFilterModel = args.filterModel || { items: [] };

        if (HasFlag(args.requestedCaps, xTableClientCaps.PaginatedQuery)) {
            console.assert(!HasFlag(args.requestedCaps, xTableClientCaps.Query)); // don't do both. why would you do both types of queries.??
            const paginatedQueryInput: db3.PaginatedQueryInput = {
                tableID: this.args.tableSpec.args.table.tableID,
                tableName: this.args.tableSpec.args.table.tableName,
                orderBy,
                skip,
                take,
                filter,
                cmdbQueryContext: `xTableRenderClient/paginated for ${args.tableSpec.args.table.tableName}`,
                clientIntention: { ...args.clientIntention, currentUser: undefined }, // don't pass bulky user to server; redundant.
            };

            const queryResult = usePaginatedQuery(db3paginatedQueries, paginatedQueryInput, args.queryOptions || gQueryOptions.default);
            //const { items, count } = queryResult[0];
            //items_ = items as TAnyModel[];

            if (!queryResult[0]) {
                items_ = [];
                this.rowCount = 0;
            } else {
                items_ = queryResult[0].items as Trow[];
                this.rowCount = queryResult[0].count;//queryResult[0].items.length;
                this.remainingQueryResults = { ...queryResult[0] };
                this.queryResultInfo = {
                    executionTimeMillis: queryResult[0].executionTimeMillis,
                    resultId: queryResult[0].resultId,
                    //resultPayloadSize: JSON.stringify(items_).length,
                };
            }

            //this.rowCount = count;
            //this.remainingQueryResults = { ...queryResult[0] };
            this.remainingQueryStatus = { ...queryResult[1] };
            this.refetch = queryResult[1].refetch;
        }

        if (HasFlag(args.requestedCaps, xTableClientCaps.Query)) {
            console.assert(!HasFlag(args.requestedCaps, xTableClientCaps.PaginatedQuery)); // don't do both. why would you do both types of queries.??
            console.assert(skip === 0 || skip === undefined);

            const queryInput: db3.QueryInput = {
                tableID: this.args.tableSpec.args.table.tableID,
                tableName: this.args.tableSpec.args.table.tableName,
                orderBy,
                take,
                filter,
                clientIntention: { ...args.clientIntention, currentUser: undefined }, // don't pass bulky user to server; redundant.
                cmdbQueryContext: `xTableRenderClient/query for ${args.tableSpec.args.table.tableName}`,
            };

            const queryResult = useQuery(db3queries, queryInput, args.queryOptions || gQueryOptions.default);

            // results may be undefined.
            if (!queryResult[0]) {
                items_ = [];
                this.rowCount = 0;
            } else {
                items_ = queryResult[0].items as Trow[];
                this.rowCount = queryResult[0].items.length;
                this.remainingQueryResults = { ...queryResult[0] };
            }
            this.remainingQueryStatus = { ...queryResult[1] };
            this.queryResultInfo = {
                executionTimeMillis: queryResult[0].executionTimeMillis,
                resultId: queryResult[0].resultId,
                //resultPayloadSize: JSON.stringify(items_).length,
            }
            this.refetch = queryResult[1].refetch;
        }

        // convert items from a database result to a client-side object.
        this.items = items_.map(dbitem => {
            return this.schema.getClientModel(dbitem, "view", args.clientIntention) as Trow;
        });

        this.refetch = this.refetch || (() => { });

        // if (process.env.NODE_ENV === "development") {
        //     React.useEffect(() => {
        //         console.log(`db3 query executed on '${this.tableSpec.args.table.tableID}': ${this.queryResultInfo.executionTimeMillis} ms; resultpayload=${formatFileSize(this.queryResultInfo.resultPayloadSize)}`);
        //         console.log(this.items);
        //     }, [this.queryResultInfo.resultId]);
        // }
    }; // ctor

    prepareMutation = <T extends TAnyModel,>(row: T, mode: db3.DB3RowMode): any => {
        const postClientModel = {}; // when applying values, it's client-value -> post-client-value -> db-value. there are 2 stages, to allow client columns to work AND the schema column.
        const dbModel = {};

        this.clientColumns.forEach(clientCol => {
            // seems to be an eternal problem; probably a bad design in general. well,
            // the case for using client schema is for EventDateRangeColumn, where the single "client" field consists of 3 underlying schema columns.
            // so the client column types need the ability to prepare things for update.
            if (clientCol.ApplyClientToPostClient) {
                clientCol.ApplyClientToPostClient(row, postClientModel, mode);
            } else {
                postClientModel[clientCol.columnName] = row[clientCol.columnName]; // by default just copy the value.
            }
        });

        this.schema.columns.forEach(schemaCol => {
            schemaCol.ApplyClientToDb(postClientModel, dbModel, mode, this.args.clientIntention);
        });
        return dbModel;
    };

    // the row as returned by the db is not the same model as the one to be passed in for updates / creation / etc.
    // all the columns in our spec though represent logical values which can be passed into mutations.
    // that is, all the columns comprise the updation model completely.
    // for things like FK, 
    doUpdateMutation = async (row: TAnyModel) => {
        console.assert(!!this.mutateFn); // make sure you request this capability!
        // const postClientModel = { }; // when applying values, it's client-value -> post-client-value -> db-value. there are 2 stages, to allow client columns to work AND the schema column.
        // const updateModel = { };

        // this.clientColumns.forEach(clientCol => {
        //     // seems to be an eternal problem; probably a bad design in general. well,
        //     // the case for using client schema is for EventDateRangeColumn, where the single "client" field consists of 3 underlying schema columns.
        //     // so the client column types need the ability to prepare things for update.
        //     if (clientCol.ApplyClientToPostClient) {
        //         clientCol.ApplyClientToPostClient(row, postClientModel, "update");
        //     } else {
        //         postClientModel[clientCol.columnName] = row[clientCol.columnName]; // by default just copy the value.
        //     }
        // });

        // this.schema.columns.forEach(schemaCol => {
        //     schemaCol.ApplyClientToDb(postClientModel, updateModel, "update");
        // });

        const dbModel = this.prepareMutation(row, "update");

        const ret = await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            clientIntention: this.args.clientIntention,
            mutationType: "update",
            updateId: row[this.schema.pkMember],
            updateModel: dbModel,
        });
        this.refetch();
        return ret;
    };

    prepareInsertMutation = <T extends TAnyModel,>(row: TAnyModel): any => {
        const dbModel = this.prepareMutation(row, "new");
        return dbModel;
    };

    doInsertMutation = async (row: TAnyModel) => {
        const dbModel = this.prepareInsertMutation(row);
        return await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            clientIntention: this.args.clientIntention,
            mutationType: "insert",
            insertModel: dbModel,
        });
    };

    doDeleteMutation = async (pk: number, deleteType: "softWhenPossible" | "hard") => {
        return await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            clientIntention: this.args.clientIntention,
            mutationType: "delete",
            deleteType,
            deleteId: pk,
        });
    };

};


export const useTableRenderContext = <Trow extends TAnyModel,>(args: xTableClientArgs) => {
    return new xTableRenderClient<Trow>(args);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface FetchAsyncArgs<T> {
    schema: db3.xTable;
    clientIntention: db3.xTableClientUsageContext;
    sortModel?: GridSortModel,
    filterModel?: CMDBTableFilterModel,
    take?: number | undefined;
    queryOptions?: any; // of gQueryOptions
    delayMS?: number;
};

export interface FetchAsyncResult<T> {
    items: T[];
    isLoading: boolean;
    refetch: () => void;
    queryResult: undefined | RestQueryResult<any, any>;
};

// allows fetching without suspense interaction
export function fetchUnsuspended<T>(args: FetchAsyncArgs<T>): FetchAsyncResult<T> {
    const queryInput: db3.QueryInput = {
        tableID: args.schema.tableID,
        tableName: args.schema.tableName,
        orderBy: CalculateOrderBy(args.sortModel),
        take: args.take,
        filter: args.filterModel || { items: [] },
        delayMS: args.delayMS,
        clientIntention: { ...args.clientIntention, currentUser: undefined }, // don't pass bulky user to server; redundant.
        cmdbQueryContext: `fetchAsync for ${args.schema.tableName} / ${args.schema.tableID}`,
    };

    const [queryRet, blitzQueryStatus] = useQuery(db3queries, queryInput, { ...(args.queryOptions || gQueryOptions.default), suspense: false });

    let dbItems: TAnyModel[] = [];
    let rowCount = 0;

    if (queryRet) {
        dbItems = queryRet.items;
        rowCount = queryRet.items.length;
    }

    // convert items from a database result to a client-side object.
    const clientItems: T[] = dbItems.map(dbitem => {
        return args.schema.getClientModel(dbitem, "view", args.clientIntention) as T;
    });

    return {
        items: clientItems,
        isLoading: blitzQueryStatus.isLoading,
        refetch: blitzQueryStatus.refetch || (() => { }),
        queryResult: blitzQueryStatus,
    };
}; // ctor



// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

