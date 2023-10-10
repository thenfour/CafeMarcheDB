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
import { Checkbox } from '@mui/material';
import { InspectObject } from 'src/core/components/CMCoreComponents';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';

const gPageSizeOptions = [10, 25, 50, 100, 250, 500] as number[];
const gPageSizeDefault = 25 as number;

export type DB3BooleanMatrixProps<TLocal, TAssociation> = {
    localTableSpec: DB3Client.xTableClientSpec,
    foreignTableSpec: DB3Client.xTableClientSpec,
    tagsField: DB3Client.TagsFieldClient<TAssociation>,
};

export function DB3AssociationMatrix<TLocal, TAssociation>(props: DB3BooleanMatrixProps<TLocal, TAssociation>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState({
        page: 0,
        pageSize: gPageSizeDefault,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });

    const [currentUser] = useCurrentUser();

    const clientIntention: db3.xTableClientUsageContext = {
        intention: 'admin',
        mode: 'primary',
        currentUser: currentUser!
    };

    const convertedFilter: db3.CMDBTableFilterModel = {
        items: filterModel.items.map((i): db3.CMDBTableFilterItem => ({
            field: i.field,
            operator: i.operator as any,
            id: i.id,
            value: i.value,
        })),
        quickFilterValues: filterModel.quickFilterValues,
    };

    const dbRows = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery | DB3Client.xTableClientCaps.Mutation,
        clientIntention,
        tableSpec: props.localTableSpec,
        filterModel: convertedFilter,// quick filter will apply to both rows & columns
        sortModel,
        paginationModel,
    });

    const dbColumns = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: props.foreignTableSpec,
        filterModel: convertedFilter,// quick filter will apply to both rows & columns
        // use the table's natural sort
    });

    const rowWhere = props.localTableSpec.args.table.CalculateWhereClause({ filterModel: convertedFilter, clientIntention });
    const rowInclude = props.localTableSpec.args.table.CalculateInclude(clientIntention);
    const columnWhere = props.foreignTableSpec.args.table.CalculateWhereClause({ filterModel: convertedFilter, clientIntention });
    const columnInclude = props.foreignTableSpec.args.table.CalculateInclude(clientIntention);

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
            const info = props.localTableSpec.args.table.getRowInfo(params.row);
            return info.name;
        }
    },
    ...dbColumns.items.map((tag): GridColDef => ({
        field: `id:${tag[props.foreignTableSpec.args.table.pkMember]}`,
        editable: false,
        headerName: props.foreignTableSpec.args.table.getRowInfo(tag).name,
        width: 80,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
            const tagId = tag[props.foreignTableSpec.args.table.pkMember];
            const fieldVal = params.row[props.tagsField.columnName] as TAssociation[];
            const association = fieldVal.find(a => a[props.tagsField.associationForeignIDMember] === tagId); // find the association for this tag.
            return <div className='MuiDataGrid-cellContent'><Checkbox
                checked={!!association}
                onChange={(event, value) => {
                    let newFieldVal = fieldVal;
                    if (!association) {
                        // add a mock association
                        newFieldVal.push(props.tagsField.typedSchemaColumn.createMockAssociation(params.row, tag));
                    } else {
                        // remove this association.
                        newFieldVal = fieldVal.filter(a => a[props.tagsField.associationForeignIDMember] !== tagId);
                    }

                    // create an update obj with just the id & the tags field.
                    console.log(`doing update mutation`);
                    dbRows.doUpdateMutation({
                        [props.localTableSpec.args.table.pkMember]: params.row[props.localTableSpec.args.table.pkMember],
                        [props.tagsField.columnName]: newFieldVal,
                    }).then((result) => {
                        showSnackbar({ children: "change successful", severity: 'success' });
                    }).catch(e => {
                        showSnackbar({ children: "change failed", severity: 'error' });
                    }).finally(() => {
                        dbRows.refetch();
                    });
                }}
            /></div>;
        }
    }))
    ];

    // now add a column for each tag.


    return (<>
        <InspectObject src={rowWhere} tooltip="ROW WHERE" />
        <InspectObject src={rowInclude} tooltip="ROW INCLUDE" />
        <InspectObject src={columnWhere} tooltip="COLUMN WHERE" />
        <InspectObject src={columnInclude} tooltip="COLUMN INCLUDE" />
        <InspectObject src={dbColumns.items} tooltip="COLUMN RESULTS" />
        <InspectObject src={dbColumns.remainingQueryResults} tooltip="COLUMN extra results" />

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
                    sortModel,
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
