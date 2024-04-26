// TODO: authorization for rows & columns

// this will differ from the other EditGrid
// rows & columns are dynamic based on the associated DB tables
// CELLS are rows in an association table.

// one way to think of this is that
// it's just a normal table where 1 row = 1 table row,
// but the grid only edits 1 single tags field, where columns are all tag options.
// so internally it works similar to the other edit grid.

import { Checkbox } from '@mui/material';
import {
    DataGrid,
    GridColDef,
    GridFilterModel,
    GridSortModel
} from '@mui/x-data-grid';
import React from "react";
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "../DB3Client";
import * as db3 from '../db3';
import { CMDBTableFilterItem, CMDBTableFilterModel, TAnyModel } from '../shared/apiTypes';

const gPageSizeOptions = [10, 25, 50, 100, 250, 500] as number[];
const gPageSizeDefault = 25 as number;

export interface DB3AssMatrxiExtraActionsArgs {
    row: TAnyModel,
};

export type DB3BooleanMatrixProps<TLocal, TAssociation> = {
    localTableSpec: DB3Client.xTableClientSpec,
    foreignTableSpec: DB3Client.xTableClientSpec,
    tagsField: DB3Client.TagsFieldClient<TAssociation>,
    renderExtraActions?: (args: DB3AssMatrxiExtraActionsArgs) => React.ReactNode,
    filterRow?: (row: TLocal) => boolean;
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

    const convertedFilter: CMDBTableFilterModel = {
        items: filterModel.items.map((i): CMDBTableFilterItem => ({
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

    const filteredRows: TLocal[] = !!props.filterRow ? (dbRows.items as TLocal[]).filter(row => props.filterRow!(row)) : (dbRows.items as TLocal[]);

    const dbColumns = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: props.foreignTableSpec,
        filterModel: convertedFilter,// quick filter will apply to both rows & columns
        // use the table's natural sort
    });

    const columns: GridColDef[] = [{
        field: "id",
        editable: false,
        valueGetter: (params) => {
            return params.row[props.localTableSpec.args.table.pkMember];
        }
    }, {
        field: "name",
        editable: false,
        width: 200,
        valueGetter: (params) => {
            const info = props.localTableSpec.args.table.getRowInfo(params.row);
            return info.name;
        }
    },
    ...dbColumns.items.map((tag): GridColDef => ({
        field: `id:${tag[props.foreignTableSpec.args.table.pkMember]}`,
        editable: false,
        headerName: props.foreignTableSpec.args.table.getRowInfo(tag).name,
        width: 120,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
            const tagId = tag[props.foreignTableSpec.args.table.pkMember];
            const fieldVal = params.row[props.tagsField.columnName] as TAssociation[];
            if (!fieldVal) {
                throw new Error(`property '${props.tagsField.columnName}' was not found on the row; maybe your query didn't include it?`);
            }
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
    })),
    {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        getActions: ({ id, ...args }) => {
            //const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;
            return [
                <React.Fragment key="extra">
                    {props.renderExtraActions && props.renderExtraActions({
                        row: args.row,
                    })}
                </React.Fragment>,
            ];
        },
    }
    ];

    const handleClickCopy = async () => {

        // create an array of pairs
        const obj: [string, string][] = [];
        const objRows: string[] = [];

        for (let iy = 0; iy < filteredRows.length; ++iy) {
            const permission = filteredRows[iy]!;// as db3.PermissionPayload;
            const associations = permission[props.tagsField.columnName] as TAssociation[];
            const permissionInfo = props.localTableSpec.args.table.getRowInfo(permission);

            for (let ix = 0; ix < dbColumns.items.length; ++ix) {
                // "tag" = X (foreign) (column) (role)
                const role = dbColumns.items[ix]!;
                const roleId = role[props.foreignTableSpec.args.table.pkMember];

                const association = associations.find(a => a[props.tagsField.associationForeignIDMember] === roleId);
                if (!association) continue;

                const roleInfo = props.foreignTableSpec.args.table.getRowInfo(role);
                obj.push([roleInfo.name, permissionInfo.name]);
                //   [ "always_grant", "Admin" ],
                objRows.push(`  [ "${roleInfo.name}", "${permissionInfo.name}" ]`);
            }
        }

        const txt = `[\n${objRows.join(`,\n`)}\n]\n`; // JSON.stringify(obj, null, 2);
        await navigator.clipboard.writeText(txt);
        showSnackbar({ severity: "success", children: `Copied ${Object.entries(obj).length} associations to clipboard (${txt.length} characters)` });
    };

    return (<div>
        {/* <InspectObject src={rowWhere} tooltip="ROW WHERE" />
        <InspectObject src={rowInclude} tooltip="ROW INCLUDE" />
        <InspectObject src={columnWhere} tooltip="COLUMN WHERE" />
        <InspectObject src={columnInclude} tooltip="COLUMN INCLUDE" />
        <InspectObject src={dbColumns.items} tooltip="COLUMN RESULTS" />
        <InspectObject src={dbColumns.remainingQueryResults} tooltip="COLUMN extra results" /> */}

        <div>
            <button onClick={handleClickCopy}>Copy</button>
        </div>

        <DataGrid
            // basic config
            density="compact"
            checkboxSelection
            disableRowSelectionOnClick

            // schema
            columns={columns}

            // actual data
            rows={filteredRows}
            rowCount={filteredRows.length}

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
    </div>
    );
};
