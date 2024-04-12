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

import { useMutation, usePaginatedQuery, useQuery } from "@blitzjs/rpc";
import React from "react";
//import * as db3 from "../db3";
import { GridColDef, GridPaginationModel, GridSortModel } from "@mui/x-data-grid";
import { assert } from "blitz";
import { Coalesce, HasFlag, SettingKey, TAnyModel, gQueryOptions } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import db3queries from "../queries/db3queries";
//import { NameValuePair } from "./DB3ClientBasicFields";


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// useful for consistent field rendering including name, value, detailed help etc.
interface RenderBasicNameValuePairProps {
    key?: string;
    className?: string;
    name: React.ReactNode;
    value: React.ReactNode;
    description?: React.ReactNode;
};

export const RenderBasicNameValuePair = (props: RenderBasicNameValuePairProps) => {
    return <div key={props.key} className={`BasicNameValuePairContainer ${props.className}`}>
        <div className="name">{props.name}</div>
        {props.description && <div className="description">{props.description}</div>}
        <div className="value">{props.value}</div>
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface NameValuePairProps {
    name: React.ReactNode;
    value: React.ReactNode;
    description?: React.ReactNode;
    className?: string;
};

export const NameValuePair = (props: NameValuePairProps) => {
    return RenderBasicNameValuePair(props);
}

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

    fieldCaption: string | undefined;
    fieldDescriptionSettingName: string | null | undefined;

    GridColProps?: Partial<GridColDef>;
};

export abstract class IColumnClient {
    // IColumnClientArgs here...
    columnName: string;
    headerName: string;
    editable: boolean;
    visible: boolean;
    width: number;

    GridColProps?: Partial<GridColDef>;

    fieldCaption: string | undefined;
    fieldDescriptionSettingName: SettingKey | null | undefined;

    abstract renderForNewDialog?: (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>
    abstract renderViewer: (params: RenderViewerArgs<unknown>) => React.ReactElement; // will render as a child of <FormControl>
    abstract ApplyClientToPostClient?: (clientRow: TAnyModel, updateModel: TAnyModel, mode: db3.DB3RowMode) => void; // applies the values from the client object to a db-compatible object.
    abstract onSchemaConnected(tableClient: xTableRenderClient): void;

    schemaTable: db3.xTable;
    schemaColumn: db3.FieldBase<unknown>;

    constructor(args: IColumnClientArgs) {
        Object.assign(this, args);
        // safety.
        assert(this.visible !== undefined, "visible is required; maybe a column client type forgot to include this in the ctor?");
        this.visible = Coalesce(this.visible, true);
    }

    // called when the table client is initialized to make sure this column object knows about its sibling column in the schema.
    connectColumn = (schemaTable: db3.xTable, tableClient: xTableRenderClient) => {
        console.assert(this.columnName.length > 0);
        //console.log(`connecting column ${this.columnName}`);
        this.schemaTable = schemaTable;
        this.schemaColumn = schemaTable.columns.find(c => c.member === this.columnName)!;
        if (!this.schemaColumn) {
            console.error(`column '${schemaTable.tableName}'.'${this.columnName}' doesn't have a corresponding field in the core schema.`);
        }
        this.onSchemaConnected && this.onSchemaConnected(tableClient);
    };

    // child classes call this when you want default rendering.
    defaultRenderer = ({ value, className }: { value: React.ReactNode, className?: string }) => {
        return <NameValuePair
            name={this.fieldCaption || this.columnName}
            description={this.fieldDescriptionSettingName && <SettingMarkdown setting={this.fieldDescriptionSettingName} />}
            value={value}
            className={className}
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

    renderEditor = <T extends TAnyModel,>(columnName: string, row: T, validationResult: db3.ValidateAndComputeDiffResult, onChange: (row: T) => void, clientIntention: db3.xTableClientUsageContext) => {
        const col = this.getColumn(columnName);

        return col.renderForNewDialog && col.renderForNewDialog({
            validationResult,
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
    remainingQueryStatus: any;
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

            const [{ items, count, ...remainingQueryResults }, { refetch, ...queryOutput }]: [{ items: unknown[], count: number }, { refetch: () => void }] = usePaginatedQuery(db3paginatedQueries, paginatedQueryInput, args.queryOptions || gQueryOptions.default);
            items_ = items as TAnyModel[];
            this.rowCount = count;
            this.remainingQueryStatus = queryOutput;
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

            this.remainingQueryStatus = queryOutput;
            this.remainingQueryResults = remainingQueryResults;
            this.rowCount = items.length;
            this.refetch = refetch;
        }

        // convert items from a database result to a client-side object.
        this.items = items_.map(dbitem => {
            return this.schema.getClientModel(dbitem as TAnyModel, "view", args.clientIntention);
        });

        this.refetch = this.refetch || (() => { });

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
        // const postClientModel = {}; // when applying values, it's client-value -> post-client-value -> db-value. there are 2 stages, to allow client columns to work AND the schema column.
        // const updateModel = {};

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
            updateModel: dbModel,
            updateId: row[this.schema.pkMember],
            clientIntention: this.args.clientIntention,
        });
        this.refetch();
        return ret;
    };

    prepareInsertMutation = <T extends TAnyModel,>(row: TAnyModel): any => {
        const dbModel = this.prepareMutation(row, "new");

        // const postClientModel: T = {} as T;
        // const dbModel: T = {} as T;

        // this.clientColumns.forEach(clientCol => {
        //     if (clientCol.ApplyClientToPostClient) {
        //         // 2-stage processing
        //         clientCol.ApplyClientToPostClient(row, postClientModel, "new");
        //         clientCol.schemaColumn.ApplyClientToDb(postClientModel, dbModel, "new");
        //     } else {
        //         // 1-stage processing
        //         clientCol.schemaColumn.ApplyClientToDb(row, dbModel, "new");
        //     }
        // });

        // this.schema.columns.forEach(col => {
        //     col.ApplyClientToDb(row, dbModel, "new");
        // });
        return dbModel;
    };

    doInsertMutation = async (row: TAnyModel) => {
        const dbModel = this.prepareInsertMutation(row);
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

