'use client';

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
//import db3queries from "../queries/db3queries";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import { GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRenderEditCellParams, GridSortModel } from "@mui/x-data-grid";
import { HasFlag, TAnyModel, gNullValue } from "shared/utils";
import { CMTextField } from "src/core/components/CMTextField";
import { ColorPick, ColorSwatch } from "src/core/components/Color";
import { ColorPaletteEntry } from "shared/color";
import { FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import db3queries from "../queries/db3queries";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface NewDialogAPI {
    // call like, params.api.setFieldValues({ [this.columnName]: val });
    setFieldValues: (fieldValues: { [key: string]: any }) => void,
};

export interface RenderForNewItemDialogArgs {
    key: any;
    row: TAnyModel; // row
    value: unknown;
    validationResult: db3.ValidateAndComputeDiffResult;
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
    abstract onSchemaConnected?: (tableClient: xTableRenderClient) => void;

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

export type TMutateFn = (args: db3.MutatorInput) => Promise<unknown>;

export enum xTableClientCaps {
    None = 0,
    PaginatedQuery = 1,
    Query = 2,
    Mutation = 4
}

export interface xTableClientArgs {
    tableSpec: xTableClientSpec,

    requestedCaps: xTableClientCaps,

    // optional for example for new item dialog which doesn't do any querying at all.
    sortModel?: GridSortModel,
    filterModel?: GridFilterModel,
    paginationModel?: GridPaginationModel,
    tableParams?: TAnyModel,
};

export class xTableRenderClient {
    tableSpec: xTableClientSpec;
    args: xTableClientArgs;
    mutateFn: TMutateFn;

    items: TAnyModel[];
    rowCount: number;
    refetch: () => void;

    get schema() {
        return this.tableSpec.args.table;
    }
    get clientColumns() {
        return this.tableSpec.args.columns;
    }

    constructor(args: xTableClientArgs) {
        this.tableSpec = args.tableSpec;
        this.args = args;

        if (HasFlag(args.requestedCaps, xTableClientCaps.Mutation)) {
            this.mutateFn = useMutation(db3mutations)[0] as TMutateFn;
        }

        let orderBy: any = undefined;//{ id: "asc" }; // default order
        if (args.sortModel && args.sortModel.length > 0) {
            orderBy = { [args.sortModel[0]!.field]: args.sortModel[0]!.sort }; // only support 1 ordering (grid does too afaik)
        }

        const where = { AND: [] as any[] };
        if (args.filterModel && args.filterModel.quickFilterValues) { // quick filtering
            const quickFilterItems = args.filterModel.quickFilterValues.map(q => {// for each token
                return {
                    OR: args.tableSpec.args.table.GetQuickFilterWhereClauseExpression(q)
                };
            });
            where.AND.push(...quickFilterItems);
        }

        if (args.filterModel && args.filterModel.items && args.filterModel.items.length > 0) { // non-quick normal filtering.
            // convert items to prisma filter
            const filterItems = args.filterModel.items.map((i) => {
                return { [i.field]: { [i.operator]: i.value } }
            });
            where.AND.push(...filterItems);
        }

        if (args.tableParams && args.tableSpec.args.table.getParameterizedWhereClause) {
            const filterItems = args.tableSpec.args.table.getParameterizedWhereClause(args.tableParams);
            if (filterItems) {
                where.AND.push(...filterItems);
            }
        }

        const skip = !!args.paginationModel ? (args.paginationModel.pageSize * args.paginationModel.page) : undefined;
        const take = !!args.paginationModel ? (args.paginationModel.pageSize) : undefined;

        for (let i = 0; i < this.clientColumns.length; ++i) {
            this.clientColumns[i]?.connectColumn(args.tableSpec.args.table, this);
        }

        let items_: TAnyModel[] = [];

        if (HasFlag(args.requestedCaps, xTableClientCaps.PaginatedQuery)) {
            console.assert(!HasFlag(args.requestedCaps, xTableClientCaps.Query)); // don't do both. why would you do both types of queries.??
            const paginatedQueryInput: db3.PaginatedQueryInput = {
                tableName: this.args.tableSpec.args.table.tableName,
                orderBy,
                skip,
                take,
                where,
            };

            const [{ items, count }, { refetch }]: [{ items: unknown[], count: number }, { refetch: () => void }] = usePaginatedQuery(db3paginatedQueries, paginatedQueryInput);
            items_ = items as TAnyModel[];
            this.rowCount = count;
            this.refetch = refetch;
        }

        if (HasFlag(args.requestedCaps, xTableClientCaps.Query)) {
            console.assert(!HasFlag(args.requestedCaps, xTableClientCaps.PaginatedQuery)); // don't do both. why would you do both types of queries.??
            const queryInput: db3.QueryInput = {
                tableName: this.args.tableSpec.args.table.tableName,
                orderBy,
                where,
            };
            const [items, { refetch }] = useQuery(db3queries, queryInput);
            items_ = items;
            this.rowCount = items.length;
            this.refetch = refetch;
        }

        // convert items from a database result to a client-side object.
        this.items = items_.map(dbitem => {
            const ret = {};
            this.clientColumns.forEach(col => {
                console.assert(!!col.schemaColumn.ApplyDbToClient);
                col.schemaColumn.ApplyDbToClient(dbitem as TAnyModel, ret, "view");
            })
            return ret;
        });

    }; // ctor

    // the row as returned by the db is not the same model as the one to be passed in for updates / creation / etc.
    // all the columns in our spec though represent logical values which can be passed into mutations.
    // that is, all the columns comprise the updation model completely.
    // for things like FK, 
    doUpdateMutation = async (row: TAnyModel) => {
        console.assert(!!this.mutateFn); // make sure you request this capability!
        const updateModel = {};
        this.clientColumns.forEach(col => {
            col.schemaColumn.ApplyClientToDb(row, updateModel, "update");
        });
        return await this.mutateFn({
            tableName: this.tableSpec.args.table.tableName,
            updateModel,
            updateId: row[this.schema.pkMember],
        });
    };

    doInsertMutation = async (row: TAnyModel) => {
        const insertModel = {};
        this.clientColumns.forEach(col => {
            col.schemaColumn.ApplyClientToDb(row, insertModel, "new");
        });
        return await this.mutateFn({
            tableName: this.tableSpec.args.table.tableName,
            insertModel,
        });
    };

    doDeleteMutation = async (pk: number) => {
        return await this.mutateFn({
            tableName: this.tableSpec.args.table.tableName,
            deleteId: pk,
        });
    };
};


export const useTableRenderContext = (args: xTableClientArgs) => {
    return new xTableRenderClient(args);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

