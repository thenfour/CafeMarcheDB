'use client';

// xTable is server-side code; for client-side things we enrich it here.

import { useMutation, usePaginatedQuery, useQuery } from "@blitzjs/rpc";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import { GridColDef, GridFilterModel, GridPaginationModel, GridSortModel } from "@mui/x-data-grid";

export interface NewDialogAPI {
    setFieldValues: (fieldValues: { [key: string]: any }) => void,
};

export interface RenderForNewItemDialogArgs<DBModel, FieldType> {
    key: any;
    obj: DBModel,
    value: FieldType;
    validationResult: db3.ValidateAndComputeDiffResult;
    api: NewDialogAPI,
};


export interface xFieldClient<RowModel, FieldType> extends db3.FieldBase {
    GridColProps?: Partial<GridColDef>;
    renderForNewDialog?: (params: RenderForNewItemDialogArgs<RowModel, FieldType>) => React.ReactElement; // will render as a child of <FormControl>
};




export interface xTableRenderClient<RowModel> extends db3.xTable<RowModel> {
    mutateFn: any,
    items: RowModel[],
    rowCount: number,
    refetch: () => void,
    doUpdateMutation: (newRow: RowModel) => Promise<RowModel>,
    doInsertMutation: (row: RowModel) => Promise<RowModel>,
    doDelete: (pk: number) => Promise<void>,
    doInsertFromString: (userInput: string) => Promise<RowModel>,
    columnClients: { [key: string]: xFieldClient },
};

export interface xTableClientArgs {
    // optional for example for new item dialog which doesn't do any querying at all.
    sortModel?: GridSortModel,
    filterModel?: GridFilterModel,
    paginationModel?: GridPaginationModel,
};

export const useTableRenderContext = <RowModel,>(table: db3.xTable<RowModel>, args: xTableClientArgs): xTableRenderClient<RowModel> => {
    // const [items, { refetch }]: [items: RowModel[], x: any] = usePaginatedQuery(db3paginatedQueries, {
    //     table: table.tableName,
    //     args: args.paginatedTableQueryParams,
    // });
    return {
        ...table,
        //     client: {
        //         mutateFn: useMutation(db3mutations),
        //         items,
        //         refetch,
        //     },
    };
};

// individual FK fields will also have enriched client objects, for querying / inserting from string, etc.
//const x = useTableRenderContext(db3.xInstrument, { paginatedTableQueryParams: { orderBy: null, take: null, skip: null, where: null } });

