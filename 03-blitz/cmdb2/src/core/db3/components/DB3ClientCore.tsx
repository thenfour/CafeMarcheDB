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

import React from "react";
import { useMutation, usePaginatedQuery, useQuery } from "@blitzjs/rpc";
//import * as db3 from "../db3";
import * as db3 from "../db3"
import db3mutations from "../mutations/db3mutations";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import { GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRenderEditCellParams, GridSortModel } from "@mui/x-data-grid";
import { HasFlag, TAnyModel, gNullValue, gQueryOptions } from "shared/utils";
import { CMTextField } from "src/core/components/CMTextField";
import { ColorPick, ColorSwatch } from "src/core/components/Color";
import { ColorPaletteEntry } from "shared/color";
import { FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import db3queries from "../queries/db3queries";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";

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
};

export interface IColumnClientArgs {
    columnName: string;
    headerName: string;
    editable: boolean;
    width: number;

    GridColProps?: Partial<GridColDef>;
};

export abstract class IColumnClient {
    columnName: string;
    headerName: string;
    editable: boolean;
    width: number;

    GridColProps?: Partial<GridColDef>;

    abstract renderForNewDialog?: (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>
    abstract onSchemaConnected(tableClient: xTableRenderClient): void;

    schemaTable: db3.xTable;
    schemaColumn: db3.FieldBase<unknown>;

    constructor(args: IColumnClientArgs) {
        Object.assign(this, args);
    }

    // called when the table client is initialized to make sure this column object knows about its sibling column in the schema.
    connectColumn = (schemaTable: db3.xTable, tableClient: xTableRenderClient) => {
        console.assert(this.columnName.length > 0);
        this.schemaTable = schemaTable;
        this.schemaColumn = schemaTable.columns.find(c => c.member === this.columnName)!;
        if (!this.schemaColumn) {
            console.error(`column '${schemaTable.tableName}'.'${this.columnName}' doesn't have a corresponding field in the core schema.`);
        }
        this.onSchemaConnected && this.onSchemaConnected(tableClient);
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
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// xTableRenderClient is an object that React components use to access functionality, access the items in the table etc.

export const CalculateOrderBy = (sortModel?: GridSortModel) => {
    let orderBy: any = undefined;//{ id: "asc" }; // default order
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
    filterModel?: db3.CMDBTableFilterModel,
    paginationModel?: GridPaginationModel,

    queryOptions?: any; // of gQueryOptions
};

export class xTableRenderClient {
    tableSpec: xTableClientSpec;
    args: xTableClientArgs;
    mutateFn: TMutateFn;

    items: TAnyModel[];
    rowCount: number;
    remainingQueryResults: any;
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

        let items_: TAnyModel[] = [];

        const filter: db3.CMDBTableFilterModel = args.filterModel || { items: [] };

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

            const [{ items, count, ...remainingQueryResults }, { refetch }]: [{ items: unknown[], count: number }, { refetch: () => void }] = usePaginatedQuery(db3paginatedQueries, paginatedQueryInput, args.queryOptions || gQueryOptions.default);
            items_ = items as TAnyModel[];
            this.rowCount = count;
            this.remainingQueryResults = remainingQueryResults;
            this.refetch = refetch;
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
            const [{ items, ...remainingQueryResults }, { refetch, ...queryOutput }] = useQuery(db3queries, queryInput, args.queryOptions || gQueryOptions.default);
            items_ = items;

            // console.log(`basic client query items on table ${this.args.tableSpec.args.table.tableName}:`);
            // console.log(items);
            // console.log(`filtermodel:`);
            // console.log(args.filterModel);

            this.remainingQueryResults = remainingQueryResults;
            this.rowCount = items.length;
            this.refetch = refetch;
        }

        // apply client-side sorting.
        if (items_ && this.tableSpec.args.table.clientLessThan) {
            const lt = this.tableSpec.args.table.clientLessThan;
            items_.sort((a, b) => {
                if (lt(a, b)) {
                    return -1;
                }
                if (lt(b, a)) {
                    return 1;
                }
                return 0;
            });
        }

        // convert items from a database result to a client-side object.
        this.items = items_.map(dbitem => {
            return this.schema.getClientModel(dbitem as TAnyModel, "view");
        });

        this.refetch = this.refetch || (() => { });

    }; // ctor

    // the row as returned by the db is not the same model as the one to be passed in for updates / creation / etc.
    // all the columns in our spec though represent logical values which can be passed into mutations.
    // that is, all the columns comprise the updation model completely.
    // for things like FK, 
    doUpdateMutation = async (row: TAnyModel) => {
        console.assert(!!this.mutateFn); // make sure you request this capability!
        const updateModel = {};
        // this.schema.columns.forEach(col => {
        //     col.ApplyClientToDb(row, updateModel, "update");
        // });
        this.clientColumns.forEach(clientCol => {
            clientCol.schemaColumn.ApplyClientToDb(row, updateModel, "update");
        });
        const ret = await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            updateModel,
            updateId: row[this.schema.pkMember],
            clientIntention: this.args.clientIntention,
        });
        // console.log(`doUpdateMutation [clientomdel, dbmodel]`);
        // console.log(row);
        // console.log(updateModel);
        this.refetch();
        return ret;
    };

    doInsertMutation = async (row: TAnyModel) => {
        const dbModel = {};
        this.schema.columns.forEach(col => {
            col.ApplyClientToDb(row, dbModel, "new");
        });
        return await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            insertModel: dbModel,
            clientIntention: this.args.clientIntention,
        });
    };

    doDeleteMutation = async (pk: number) => {
        return await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            deleteId: pk,
            clientIntention: this.args.clientIntention,
        });
    };
};


export const useTableRenderContext = (args: xTableClientArgs) => {
    return new xTableRenderClient(args);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

