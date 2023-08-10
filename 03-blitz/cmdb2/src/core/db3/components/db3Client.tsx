'use client';

// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import React from "react";
import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
//import db3queries from "../queries/db3queries";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import { GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRenderEditCellParams, GridSortModel } from "@mui/x-data-grid";
import { HasFlag, TAnyModel, gNullValue } from "shared/utils";
import { CMTextField } from "src/core/cmdashboard/CMTextField";
import { ColorPick, ColorSwatch } from "src/core/components/Color";
import { ColorPaletteEntry } from "shared/color";
import { FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface NewDialogAPI {
    // call like, params.api.setFieldValues({ [this.columnName]: val });
    setFieldValues: (fieldValues: { [key: string]: any }) => void,
};

export interface RenderForNewItemDialogArgs {
    key: any;
    obj: unknown,
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
    abstract onSchemaConnected?: () => void;

    schemaTable: db3.xTable;
    schemaColumn: db3.FieldBase<unknown>;

    constructor(args: IColumnClientArgs) {
        Object.assign(this, args);
    }

    // called when the table client is initialized to make sure this column object knows about its sibling column in the schema.
    connectColumn = (schemaTable: db3.xTable) => {
        console.assert(this.columnName.length > 0);
        this.schemaTable = schemaTable;
        this.schemaColumn = schemaTable.columns.find(c => c.member === this.columnName)!;
        console.assert(!!this.schemaColumn);
        this.onSchemaConnected && this.onSchemaConnected();
    };
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface PKColumnArgs {
    columnName: string;
};

export class PKColumnClient extends IColumnClient {
    constructor(args: PKColumnArgs) {
        super({
            columnName: args.columnName,
            editable: false,
            headerName: args.columnName,
            width: 50,
            GridColProps: {
                type: "number",
            }
        });
    }

    renderForNewDialog = undefined;// (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>
    onSchemaConnected = undefined;
};

export interface GenericStringColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class GenericStringColumnClient extends IColumnClient {
    constructor(args: GenericStringColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: 220,
        });
    }
    onSchemaConnected = undefined;

    renderForNewDialog = (params: RenderForNewItemDialogArgs) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            validationError={params.validationResult.getErrorForField(this.columnName)}
            value={params.value as string}
            onChange={(e, val) => {
                params.api.setFieldValues({ [this.columnName]: val });
            }}
        />;
    };
};

export interface GenericIntegerColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class GenericIntegerColumnClient extends IColumnClient {
    constructor(args: GenericIntegerColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
            GridColProps: {
                type: "number",
            }
        });
    }

    onSchemaConnected = undefined;

    renderForNewDialog = (params: RenderForNewItemDialogArgs) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            validationError={params.validationResult.getErrorForField(this.columnName)}
            value={params.value as string}
            onChange={(e, val) => {
                // so this sets the row model value to a string. that's OK because the value gets parsed later.
                // in fact it's convenient because it allows temporarily-invalid inputs instead of joltingly changing the user's own input.
                params.api.setFieldValues({ [this.columnName]: val });
            }}
        />;
    };
};

export interface ColorColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class ColorColumnClient extends IColumnClient {
    constructor(args: ColorColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
            GridColProps: {
                renderCell: (args: GridRenderCellParams) => {
                    return <ColorSwatch selected={true} color={args.value} />; // colorswatch must be aware of null values.
                },
                renderEditCell: (args: GridRenderEditCellParams) => {
                    return <ColorPick
                        value={args.value}
                        palette={(this.schemaColumn as db3.ColorField).palette}
                        onChange={(value: ColorPaletteEntry) => {
                            args.api.setEditCellValue({ id: args.id, field: this.schemaColumn.member, value: value });
                        }}
                    />;

                },
            }
        });
    }

    onSchemaConnected = undefined;

    // will render as a child of <FormControl>
    renderForNewDialog = (params: RenderForNewItemDialogArgs) => {
        return <ColorPick
            value={params.value as ColorPaletteEntry | null}
            palette={(this.schemaColumn as db3.ColorField).palette}
            onChange={(value: ColorPaletteEntry) => {
                params.api.setFieldValues({ [this.schemaColumn.member]: value }); // params.api.setFieldValues({ [this.columnName]: val });
                //args.api.setEditCellValue({ id: args.id, field: this.schemaColumn.member, value: value });
            }}
        />;
    };
};


export interface ConstEnumStringFieldClientArgs {
    columnName: string;
    cellWidth: number;
};

export class ConstEnumStringFieldClient extends IColumnClient {
    gridOptions: { value: string, label: string }[];
    enumSchemaColumn: db3.ConstEnumStringField;

    constructor(args: ConstEnumStringFieldClientArgs) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
        });
    }

    onSchemaConnected = () => {
        this.enumSchemaColumn = this.schemaColumn as db3.ConstEnumStringField;

        this.gridOptions = Object.entries(this.enumSchemaColumn.options).map(([k, v]) => {
            return { value: k, label: v };
        });

        // if we use datagrid's builtin singleselect column, it doesn't support null. so use a sentinel value.
        this.gridOptions = [{ value: gNullValue, label: "--" }, ...this.gridOptions];

        this.GridColProps = {
            type: "singleSelect",
            valueOptions: this.gridOptions,
            valueGetter: (params) => params.value === null ? gNullValue : params.value, // transform underlying row model value to the value the grid will use in the selection box.
            valueSetter: (params) => { // transform select value to grid value.
                const val = params.value === gNullValue ? null : params.value;
                return { ...params.row, [this.schemaColumn.member]: val };
            },
            getOptionValue: (value: any) => value.value,
            getOptionLabel: (value: any) => value.label,
        };
    };

    renderForNewDialog = (params: RenderForNewItemDialogArgs) => {
        const value = params.value === null ? gNullValue : params.value;
        return <React.Fragment key={params.key}>
            <InputLabel>{this.schemaColumn.label}</InputLabel>
            <Select
                value={value}
                error={!!params.validationResult.hasErrorForField(this.schemaColumn.member)}
                onChange={e => {
                    let userInputValue: (string | null) = e.target.value as string;
                    if (userInputValue === gNullValue) {
                        userInputValue = null;
                    }
                    return params.api.setFieldValues({ [this.schemaColumn.member]: userInputValue });
                }}
            >
                {
                    this.gridOptions.map(option => {
                        return <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>;
                    })
                }
            </Select>
            <FormHelperText>Here's my helper text</FormHelperText>
        </React.Fragment>;

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
    }
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
};

export class xTableRenderClient {
    tableSpec: xTableClientSpec;
    args: xTableClientArgs;
    mutateFn: TMutateFn;

    items: unknown[];
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

        const skip = !!args.paginationModel ? (args.paginationModel.pageSize * args.paginationModel.page) : undefined;
        const take = !!args.paginationModel ? (args.paginationModel.pageSize) : undefined;

        const paginatedQueryInput: db3.PaginatedQueryInput = {
            tableName: this.args.tableSpec.args.table.tableName,
            orderBy,
            skip,
            take,
            where,
        };

        for (let i = 0; i < this.clientColumns.length; ++i) {
            this.clientColumns[i]?.connectColumn(args.tableSpec.args.table);
        }

        if (HasFlag(args.requestedCaps, xTableClientCaps.PaginatedQuery)) {
            const [{ items, count }, { refetch }]: [{ items: unknown[], count: number }, { refetch: () => void }] = usePaginatedQuery(db3paginatedQueries, paginatedQueryInput);

            // convert items from a database result to a client-side object.
            this.items = items.map(dbitem => {
                const ret = {};
                this.clientColumns.forEach(col => {
                    console.assert(!!col.schemaColumn.ApplyDbToClient);
                    col.schemaColumn.ApplyDbToClient(dbitem as TAnyModel, ret);
                })
                return ret;
            });

            this.rowCount = count;
            this.refetch = refetch;
        }
    }; // ctor

    // the row as returned by the db is not the same model as the one to be passed in for updates / creation / etc.
    // all the columns in our spec though represent logical values which can be passed into mutations.
    // that is, all the columns comprise the updation model completely.
    // for things like FK, 
    doUpdateMutation = async (row: TAnyModel) => {
        const updateModel = {};
        this.clientColumns.forEach(col => {
            col.schemaColumn.ApplyClientToDb(row, updateModel);
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
            col.schemaColumn.ApplyClientToDb(row, insertModel);
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

