'use client';

// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
//import db3queries from "../queries/db3queries";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import { GridColDef, GridFilterModel, GridPaginationModel, GridRenderCellParams, GridRenderEditCellParams, GridSortModel } from "@mui/x-data-grid";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface NewDialogAPI {
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
    abstract renderForEditGridView?: (params: GridRenderCellParams) => React.ReactElement;
    abstract renderForEditGridEdit?: (params: GridRenderEditCellParams) => React.ReactElement;

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
    renderForEditGridView = undefined;//: (params: GridRenderCellParams) => React.ReactElement;
    renderForEditGridEdit = undefined;//?: (params: GridRenderEditCellParams) => React.ReactElement;

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
    renderForNewDialog = undefined;// (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>
    renderForEditGridView = undefined;//: (params: GridRenderCellParams) => React.ReactElement;
    renderForEditGridEdit = undefined;//?: (params: GridRenderEditCellParams) => React.ReactElement;
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
// xTableRenderClient is an object that React components use to access functionality.

type TMutateFn = (args: db3.MutatorInput) => Promise<unknown>;

export interface xTableClientArgs {
    // optional for example for new item dialog which doesn't do any querying at all.
    tableSpec: xTableClientSpec,
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

        console.log(`db3 client ctor`);

        //this.table = args.tableSpec;
        this.tableSpec = args.tableSpec;
        this.args = args;
        this.mutateFn = useMutation(db3mutations)[0] as TMutateFn;

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

        const [{ items, count }, { refetch }]: [{ items: unknown[], count: number }, { refetch: () => void }] = usePaginatedQuery(db3paginatedQueries, paginatedQueryInput);

        this.items = items;
        this.rowCount = count;
        this.refetch = refetch;
    }; // ctor

    //     doUpdateMutation: (newRow: unknown) => Promise<unknown>,
    //     doInsertMutation: (row: unknown) => Promise<unknown>,
    //     doDeleteMutation: (pk: number) => Promise<void>,
};


export const useTableRenderContext = (args: xTableClientArgs) => {
    return new xTableRenderClient(args);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

