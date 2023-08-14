// this will differ from the other EditGrid
// rows & columns are dynamic based on the associated DB tables
// CELLS are rows in an association table.

// one way to think of this is that
// it's just a normal table where 1 row = 1 table row,
// but the grid only edits 1 single tags field, where columns are all tag options.
// so internally it works similar to the other edit grid.

import {
    DataGrid,
    GridColDef,
    GridFilterModel,
    GridRenderCellParams,
    GridSortModel
} from '@mui/x-data-grid';
import React from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from '../db3';
import * as DB3Client from "../DB3Client";
import { TAnyModel, gIDValue, gNameValue, gNullValue } from 'shared/utils';

const gPageSizeOptions = [30, 60, 90, 120, 240] as number[];
const gPageSizeDefault = 30 as number;

export type DB3BooleanMatrixProps<TLocal, TAssociation> = {
    localTableSpec: DB3Client.xTableClientSpec,
    //localMember: string,
    tagsField: DB3Client.TagsFieldClient<TAssociation>,
    //getRowName: (a: TLocal) => string;
    //getTagName: (a: TAssociation) => string;
};

export function DB3AssociationMatrix<TLocal, TAssociation>(props: DB3BooleanMatrixProps<TLocal, TAssociation>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    //const [toggleMutation] = useMutation(spec.ToggleMutation);

    // const tagsFieldCtx = DB3Client.useTagsFieldRenderContext({

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState({
        page: 0,
        pageSize: gPageSizeDefault,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    // let orderBy = spec.DefaultOrderBy;//{ id: "asc" }; // default order
    // if (sortModel && sortModel.length > 0) {
    //     orderBy = { [sortModel[0]!.field]: sortModel[0]!.sort }; // only support 1 ordering (grid does too afaik)
    // }

    const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });
    // const where = { AND: [] as any[] };
    // if (filterModel.quickFilterValues) {
    //     const quickFilterItems = filterModel.quickFilterValues.map(q => {
    //         return {
    //             OR: spec.GetQuickFilterWhereClauseExpression(q)
    //         };
    //     });
    //     where.AND.push(...quickFilterItems);
    // }
    // if (filterModel.items && filterModel.items.length > 0) {
    //     // convert items to prisma filter
    //     const filterItems = filterModel.items.map((i) => {
    //         return { [i.field]: { [i.operator]: i.value } }
    //     });
    //     where.AND.push(...filterItems);
    // }

    // const [{ rows, count, columns: dbColumns }, { refetch: refetchRows }] = usePaginatedQuery(spec.GetPaginatedRowsIncludingAssociationsQuery, {
    //     orderBy,
    //     where,
    //     skip: paginationModel.pageSize * paginationModel.page,
    //     take: paginationModel.pageSize,
    // });

    // we need to reshape items into something with fields per column.

    //console.log(`${typeof rows}, ${typeof dbColumns}`);

    // const columns: GridColDef[] = [{
    //     field: spec.RowPKField,
    // }, {
    //     field: spec.RowNameField,
    // }];

    // // when single-click toggling a state.
    // const handleClick_simpleToggle = (params: GridRenderCellParams) => {
    //     const existingAssociation = params.row[params.colDef.field] as TAssociation | null;
    //     toggleMutation({ association: existingAssociation, xId: +params.colDef.field, yId: params.row.id } as any).then((result) => {
    //         showSnackbar({ children: spec.ToggleSuccessSnackbar(existingAssociation, result as TAssociation | null), severity: 'success' });
    //         refetchRows();
    //     }).catch(e => {
    //         showSnackbar({ children: spec.ToggleErrorSnackbar(e), severity: 'error' });
    //     });
    // };

    // columns.push(...dbColumns.map(c => {
    //     const args: CMAssociationMatrixSpecColumnPropsParams<Tx, TAssociation, Ty> = {
    //         handleClick_simpleToggle,
    //     };
    //     return {
    //         field: spec.GetRowFieldForColumn(c),
    //         headerName: spec.GetColumnHeading(c),
    //         ...spec.GetGridColumnProps(c, args),
    //     } as GridColDef;
    // }));

    //const rowsTableSpec = props.localTableSpec;
    //const columnsTableSpec = props.localTableSpec.args.table.columns.find(c => c.member === props.localMember);

    // DB3Client.useTagsFieldRenderContext({

    // });

    const dbRows = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,
        tableSpec: props.localTableSpec,
        filterModel,
        sortModel,
        paginationModel,
    });

    // const dbColumns = DB3Client.useTableRenderContext({
    //     requestedCaps: DB3Client.xTableClientCaps.Query,
    //     tableSpec: columnsTableSpec,
    //     filterModel,
    //     sortModel,
    //     paginationModel,
    // });

    // the db data must be transformed. each row should get a field for every possible column.
    // const gridRows: TAnyModel[] = dbRows.items.map((dbRow) => {
    //     const ret: TAnyModel = {};
    //     ret[gIDValue] = dbRow[props.rowTable.args.table.pkMember];
    //     ret[gNameValue] = dbRow[props.getRowName(dbRow[props.rowTableMember])];
    //     dbColumns.items.forEach(dbColumn => {
    //         //ret[dbColumn[props.columnTable.args.table.pkMember]] = 
    //     });
    //     return ret;
    // });

    //console.log(`grid rows : `);
    //console.log(gridRows);
    // const columns: GridColDef[] = [{
    //     field: "rowID__",
    // }, {
    //     field: "rowName__",
    // }];

    // // when single-click toggling a state.
    // const handleClick_simpleToggle = (params: GridRenderCellParams) => {
    //     const existingAssociation = params.row[params.colDef.field] as TAssociation | null;
    //     toggleMutation({ association: existingAssociation, xId: +params.colDef.field, yId: params.row.id } as any).then((result) => {
    //         showSnackbar({ children: spec.ToggleSuccessSnackbar(existingAssociation, result as TAssociation | null), severity: 'success' });
    //         refetchRows();
    //     }).catch(e => {
    //         showSnackbar({ children: spec.ToggleErrorSnackbar(e), severity: 'error' });
    //     });
    // };

    // columns.push(...dbColumns.items.map(c => {
    //     // const args: CMAssociationMatrixSpecColumnPropsParams<Tx, TAssociation, Ty> = {
    //     //     handleClick_simpleToggle,
    //     // };
    //     return {
    //         //
    //         //field: spec.GetRowFieldForColumn(c),
    //         //headerName: spec.GetColumnHeading(c),
    //         //...spec.GetGridColumnProps(c, args),
    //     } as GridColDef;
    // }));

    const columns: GridColDef[] = [{
        field: "id",
        editable: false,
        valueGetter: (params) => {
            return params.row[props.localTableSpec.args.table.pkMember];
        }
    }, {
        field: "name",
        editable: false,
        valueGetter: (params) => {
            return "";//params.row[prop];
        }
    }];

    return (<>
        <DataGrid
            // basic config
            density="compact"
            checkboxSelection
            disableRowSelectionOnClick

            // schema
            columns={columns}

            // actual data
            rows={dbRows.items}
            rowCount={dbRows.rowCount}

            // initial state
            initialState={{
                pagination: {
                    paginationModel
                },
                sorting: {
                    sortModel,//: [{ field: 'rating', sort: 'desc' }],
                },
                filter: {
                    filterModel: {
                        items: [],
                    },
                },
            }}

            // pagination
            paginationMode="server"
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={gPageSizeOptions}

            // sorting
            sortingMode="server"
            onSortModelChange={(model) => {
                setSortModel(model);
            }}

            // filtering
            filterMode="server"
            onFilterModelChange={(model) => {
                setFilterModel(model);
            }}

        />
    </>
    );
};
