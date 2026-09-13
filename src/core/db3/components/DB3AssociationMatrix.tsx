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
    type GridColDef,
    type GridFilterModel,
    type GridSortModel
} from '@mui/x-data-grid';
import React from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "../DB3Client";
import type { CMDBTableFilterItem, CMDBTableFilterModel } from '../shared/apiTypes';
import { TAnyModel } from '@/shared/rootroot';

const gPageSizeOptions = [10, 25, 50, 100, 250, 500] as number[];

// we don't really get page support here so choose a bigger number.
const gPageSizeDefault = 100 as number;

export interface DB3AssMatrxiExtraActionsArgs {
    row: TAnyModel,
};

export type DB3BooleanMatrixProps<TLocal extends TAnyModel, TAssociation extends TAnyModel> = {
    localTableSpec: DB3Client.xTableClientSpec,
    foreignTableSpec: DB3Client.xTableClientSpec,
    tagsField: DB3Client.TagsFieldClient<TAssociation>,
    renderExtraActions?: (args: DB3AssMatrxiExtraActionsArgs) => React.ReactNode,
    filterRow?: (row: TLocal) => boolean;
};

export function DB3AssociationMatrix<TLocal extends TAnyModel, TAssociation extends TAnyModel>(props: DB3BooleanMatrixProps<TLocal, TAssociation>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState({
        page: 0,
        pageSize: gPageSizeDefault,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });




    const convertedFilter: CMDBTableFilterModel = {
        items: filterModel.items.filter(i => i.value !== undefined).map((i): CMDBTableFilterItem => ({
            field: i.field,
            operator: i.operator as any,
            id: i.id,
            value: i.value,
        })),
        quickFilterValues: filterModel.quickFilterValues,
    };

    const dbRows = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery | DB3Client.xTableClientCaps.Mutation,
        tableSpec: props.localTableSpec,
        filterModel: convertedFilter,// quick filter will apply to both rows & columns
        sortModel,
        paginationModel,
    });

    const filteredRows: TLocal[] = !!props.filterRow ? (dbRows.items as TLocal[]).filter(row => props.filterRow!(row)) : (dbRows.items as TLocal[]);

    const dbColumns = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
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

        const orderedRows = filteredRows.slice().sort((a, b) => {
            const aInfo = props.localTableSpec.args.table.getRowInfo(a);
            const bInfo = props.localTableSpec.args.table.getRowInfo(b);
            return aInfo.name.localeCompare(bInfo.name);
        });
        const orderedColumns = dbColumns.items.slice().sort((a, b) => {
            const aInfo = props.foreignTableSpec.args.table.getRowInfo(a);
            const bInfo = props.foreignTableSpec.args.table.getRowInfo(b);
            return aInfo.name.localeCompare(bInfo.name);
        });

        for (let ix = 0; ix < orderedColumns.length; ++ix) {
            // "tag" = X (foreign) (column) (role)
            const role = orderedColumns[ix]!;
            const roleId = role[props.foreignTableSpec.args.table.pkMember];

            for (let iy = 0; iy < orderedRows.length; ++iy) {
                const permission = orderedRows[iy]!;// as db3.PermissionPayload;
                const associations = permission[props.tagsField.columnName] as TAssociation[];
                const permissionInfo = props.localTableSpec.args.table.getRowInfo(permission);


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
