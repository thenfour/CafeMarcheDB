// this will differ from the other EditGrid
// rows & columns are dynamic based on the associated DB tables
// CELLS are rows in an association table.

import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
import {
    DataGrid,
    GridColDef,
    GridFilterModel,
    GridRenderCellParams,
    GridSortModel
} from '@mui/x-data-grid';
import React from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { CMAssociationMatrixSpec, CMAssociationMatrixSpecColumnPropsParams } from "./CMColumnSpec";

export type CM2DBooleanMatrixProps<Tx, TAssociation, Ty> = {
    spec: CMAssociationMatrixSpec<Tx, TAssociation, Ty>,
};

export function CMAssociationMatrix<Tx, TAssociation, Ty>({ spec }: CM2DBooleanMatrixProps<Tx, TAssociation, Ty>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [toggleMutation] = useMutation(spec.ToggleMutation);

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState({
        page: 0,
        pageSize: spec.PageSizeDefault,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    let orderBy = spec.DefaultOrderBy;//{ id: "asc" }; // default order
    if (sortModel && sortModel.length > 0) {
        orderBy = { [sortModel[0]!.field]: sortModel[0]!.sort }; // only support 1 ordering (grid does too afaik)
    }

    const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });
    const where = { AND: [] as any[] };
    if (filterModel.quickFilterValues) {
        const quickFilterItems = filterModel.quickFilterValues.map(q => {
            return {
                OR: spec.GetQuickFilterWhereClauseExpression(q)
            };
        });
        where.AND.push(...quickFilterItems);
    }
    if (filterModel.items && filterModel.items.length > 0) {
        // convert items to prisma filter
        const filterItems = filterModel.items.map((i) => {
            return { [i.field]: { [i.operator]: i.value } }
        });
        where.AND.push(...filterItems);
    }

    const [{ rows, count, columns: dbColumns }, { refetch: refetchRows }] = usePaginatedQuery(spec.GetPaginatedRowsIncludingAssociationsQuery, {
        orderBy,
        where,
        skip: paginationModel.pageSize * paginationModel.page,
        take: paginationModel.pageSize,
    });

    // we need to reshape items into something with fields per column.

    console.log(`${typeof rows}, ${typeof dbColumns}`);

    const columns: GridColDef[] = [{
        field: spec.RowPKField,
    }, {
        field: spec.RowNameField,
    }];

    // when single-click toggling a state.
    const handleClick_simpleToggle = (params: GridRenderCellParams) => {
        const existingAssociation = params.row[params.colDef.field] as TAssociation | null;
        toggleMutation({ association: existingAssociation, xId: +params.colDef.field, yId: params.row.id } as any).then((result) => {
            showSnackbar({ children: spec.ToggleSuccessSnackbar(existingAssociation, result as TAssociation | null), severity: 'success' });
            refetchRows();
        }).catch(e => {
            showSnackbar({ children: spec.ToggleErrorSnackbar(e), severity: 'error' });
        });
    };

    columns.push(...dbColumns.map(c => {
        const args: CMAssociationMatrixSpecColumnPropsParams<Tx, TAssociation, Ty> = {
            handleClick_simpleToggle,
        };
        return {
            field: spec.GetRowFieldForColumn(c),
            headerName: spec.GetColumnHeading(c),
            ...spec.GetGridColumnProps(c, args),
        } as GridColDef;
    }));

    return (<>
        <DataGrid
            // basic config
            density="compact"
            checkboxSelection
            disableRowSelectionOnClick

            // schema
            columns={columns}

            // actual data
            rows={rows}
            rowCount={count}

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
            pageSizeOptions={spec.PageSizeOptions}

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
