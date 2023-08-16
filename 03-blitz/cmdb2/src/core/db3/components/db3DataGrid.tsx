// todo:
// x number field
// x const enum field type
// x color field
// x new item dlg
// x fk single field type
// x fk multi field type
// x when clicking outside to exit edit mode, check validation before allowing this.
// x when clicking save, don't bother confirming.
// x respect onRowModesModelChange "fieldToFocus" to focus a field upon entering edit.

import {
    Add as AddIcon,
    Close as CancelIcon,
    DeleteOutlined as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import {
    Button, Dialog, DialogActions, DialogContent,
    DialogTitle
} from "@mui/material";
import {
    DataGrid,
    GridActionsCellItem,
    GridColDef,
    GridFilterModel,
    GridPaginationModel,
    GridRowEditStopParams,
    GridRowHeightParams,
    GridRowModel, GridRowModes, GridRowModesModel, GridSortModel, GridToolbarContainer, GridToolbarFilterButton,
    GridToolbarQuickFilter,
    MuiEvent
} from '@mui/x-data-grid';
import React from "react";
import { useBeforeunload } from 'react-beforeunload';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "../DB3Client";
import { DB3NewObjectDialog } from "./db3NewObjectDialog";
import { TAnyModel } from 'shared/utils';

const gPageSizeOptions = [10, 25, 50, 100, 250, 500] as number[];
const gPageSizeDefault = 25 as number;

function CustomToolbar({ onNewClicked, tableSpec }: { onNewClicked: any, tableSpec: DB3Client.xTableClientSpec }) {
    return (
        <GridToolbarContainer>
            <Button startIcon={<AddIcon />} onClick={onNewClicked}>insert {tableSpec.args.table.tableName}</Button>

            {/* <GridToolbarColumnsButton /> */}
            <GridToolbarFilterButton />
            {/* <GridToolbarDensitySelector /> */}
            {/* <GridToolbarExport /> */}
            <GridToolbarQuickFilter />
        </GridToolbarContainer>
    );
}

export interface DB3EditGridExtraActionsArgs {
    row: TAnyModel,
};

export type DB3EditGridProps = {
    tableSpec: DB3Client.xTableClientSpec,
    renderExtraActions?: (args: DB3EditGridExtraActionsArgs) => React.ReactNode,
};

export function DB3EditGrid({ tableSpec, ...props }: DB3EditGridProps) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({
        page: 0,
        pageSize: gPageSizeDefault,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });

    const tableClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Mutation | DB3Client.xTableClientCaps.PaginatedQuery,
        tableSpec,
        filterModel,
        sortModel,
        paginationModel,
    });

    const [rowModesModel, setRowModesModel] = React.useState({});
    const [explicitSave, setExplicitSave] = React.useState(false); // flag to know if the user proactively clicked save, otherwise we consider it implied and requires stronger consent
    const [deleteRowId, setDeleteRowId] = React.useState(null); // needed to display a confirmation dlg

    const handleEditClick = (id) => () => {
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
    };

    const handleSaveClick = (id) => () => {
        setExplicitSave(true);
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
    };

    const handleDeleteClick = (id) => () => {
        setDeleteRowId(id);
    };

    const handleCancelClick = (id) => () => {
        setRowModesModel({
            ...rowModesModel,
            [id]: { mode: GridRowModes.View, ignoreModifications: true },
        });
    };

    const [confirmDialogArgs, setConfirmDialogArgs] = React.useState<any>(null);

    const processRowUpdate = (newRow: GridRowModel, oldRow: GridRowModel) => {
        //console.log(`processRowUpdate ${JSON.stringify(newRow)}`);
        return new Promise<GridRowModel>((resolve, reject) => {
            const validateResult = tableSpec.args.table.ValidateAndComputeDiff(oldRow, newRow);
            // there are 3 possible paths:
            // 1. validation errors
            // 2. or, changes made
            // 3. or, no changes
            if (!validateResult.success) {
                // display validation error.
                console.log(`processRowUpdate: validation error (validateResult):`);
                //console.log(validateResult);
                //alert(`validation error`);
                reject(validateResult.errors);
            }
            else if (validateResult.hasChanges) {
                // Save the arguments to resolve or reject the promise later
                setConfirmDialogArgs({ resolve, reject, newRow, oldRow, validateResult });
            } else {
                showSnackbar({ children: "no changes made", severity: 'success' });
                resolve(oldRow); // Nothing was changed
            }
        });
    };

    const [showingNewDialog, setShowingNewDialog] = React.useState<boolean>(false);

    const handleNo = () => {
        const { oldRow, resolve } = confirmDialogArgs;
        resolve(oldRow); // Resolve with the old row to not update the internal state
        setConfirmDialogArgs(null);
    };

    const handleYes = () => {
        const { newRow, oldRow, reject, resolve }: { newRow, oldRow, reject: any, resolve: any } = confirmDialogArgs;
        try {
            tableClient.doUpdateMutation(newRow).then((updatedObj) => {
                showSnackbar({ children: "update success", severity: 'success' });
                tableClient.refetch();
            }).catch((reason => {
                showSnackbar({ children: "update error", severity: 'error' });
                tableClient.refetch();
            }));
            resolve(newRow); // optimistic
        } catch (error) {
            showSnackbar({ children: "update exception", severity: 'error' });
            reject(oldRow);
        }
        setConfirmDialogArgs(null);
    };

    const renderDeleteConfirmation = () => {
        if (!deleteRowId) {
            return null;
        }
        const handleYes = () => {
            tableClient.doDeleteMutation(deleteRowId).then(() => {
                showSnackbar({ children: "deleted successful", severity: 'success' });
                setDeleteRowId(null);
                tableClient.refetch();
            }).catch(e => {
                showSnackbar({ children: "delete error", severity: 'error' });
                console.error(e);
            });
        };
        // const row = items.find(u => u[spec.PKIDMemberName] == deleteRowId);
        // if (!row) { // not found wut? maybe some weird async pagination or background refresh error
        //     setDeleteRowId(null);
        //     return null;
        // }

        const handleClose = () => setDeleteRowId(null);

        return (
            <Dialog
                open={true}
                onClose={handleClose}
            >
                <DialogTitle>Delete row?</DialogTitle>
                <DialogContent dividers>
                    confirm delete
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>No</Button>
                    <Button onClick={handleYes}>Yes</Button>
                </DialogActions>
            </Dialog>
        );
    };

    const renderConfirmDialog = () => {
        if (!confirmDialogArgs) {
            return null;
        }

        const { oldRow, newRow, validateResult } = confirmDialogArgs;

        return (
            <Dialog
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                open={true}
                onClose={handleNo}
            >
                <DialogTitle>{explicitSave ? "Are you sure?" : "Save your changes?"}</DialogTitle>
                <DialogContent dividers>
                    confirm update...
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleNo}>No</Button>
                    {/* type=submit doesn't seem to work. why? */}
                    <Button autoFocus={true} type="submit" onClick={handleYes}>Yes</Button>
                </DialogActions>
            </Dialog>
        );
    };

    const onAddOK = (obj) => {
        tableClient.doInsertMutation(obj).then((newRow) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
            tableClient.refetch();
        }).catch(err => {
            showSnackbar({ children: "insert error", severity: 'error' });
            tableClient.refetch();
        });
        setShowingNewDialog(false);
    };

    const isAnyRowEdited = (rowModels: GridRowModesModel) => {
        for (const rowModel of Object.values(rowModels)) {
            if (rowModel.mode === GridRowModes.Edit) {
                return true;
            }
        }
        return false;
    };

    const isDirty = !!showingNewDialog || isAnyRowEdited(rowModesModel);

    useBeforeunload(isDirty ? (event) => event.preventDefault() : null);

    const fkidColumns: GridColDef[] = [];
    const columns: GridColDef[] = [];

    for (let i = 0; i < tableClient.clientColumns.length; ++i) {
        const column = tableClient.clientColumns[i]!;
        const c: GridColDef = {
            field: column.columnName,
            headerName: column.headerName,
            editable: column.editable,
            width: column.width,
        };
        if (column.GridColProps) {
            Object.assign(c, column.GridColProps);
        }

        columns.push(c);
    }

    columns.push(...fkidColumns,
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            getActions: ({ id, ...args }) => {
                const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;

                if (isInEditMode) {
                    return [
                        <GridActionsCellItem
                            key="save"
                            icon={<SaveIcon className="hoverActionIcon" />}
                            label="Save"
                            onClick={handleSaveClick(id)}
                        />,
                        <GridActionsCellItem
                            key="concel"
                            icon={<CancelIcon className="hoverActionIcon" />}
                            label="Cancel"
                            onClick={handleCancelClick(id)}
                            color="inherit"
                        />,
                    ];
                }

                return [
                    <GridActionsCellItem
                        icon={<EditIcon className="hoverActionIcon" />}
                        key="edit"
                        label="Edit"
                        onClick={handleEditClick(id)}
                        color="inherit"
                    />,
                    <GridActionsCellItem
                        icon={<DeleteIcon className="hoverActionIcon" />}
                        key="delete"
                        label="Delete"
                        onClick={handleDeleteClick(id)}
                        color="inherit"
                    />,
                    <React.Fragment key="extra">
                        {props.renderExtraActions && props.renderExtraActions({
                            row: args.row,
                        })}
                    </React.Fragment>,
                ];
            },
        });

    return (<>
        {renderConfirmDialog()}
        {renderDeleteConfirmation()}

        {!!showingNewDialog && <DB3NewObjectDialog
            onCancel={() => { setShowingNewDialog(false); }}
            onOK={onAddOK}
            table={tableSpec}
        />}
        <DataGrid
            // basic config
            editMode="row"
            density="compact"
            checkboxSelection
            className="CMEditGrid2"
            disableRowSelectionOnClick
            slots={{
                toolbar: CustomToolbar,
            }}
            slotProps={{
                toolbar: {
                    onNewClicked: () => { setShowingNewDialog(true); },
                    tableSpec: tableSpec,
                }
            }}
            getRowHeight={() => 'auto'}

            columns={columns}

            // actual data
            rows={tableClient.items as any}
            rowCount={tableClient.rowCount}

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

            // editing
            rowModesModel={rowModesModel}
            onRowModesModelChange={(newRowModesModel: GridRowModesModel) => {
                setExplicitSave(false); // this is called before editing, or after saving. so it's safe to reset explicit save flag always here.
                setRowModesModel(newRowModesModel);
            }}
            onProcessRowUpdateError={(error) => { console.error(error) }}
            processRowUpdate={processRowUpdate}
        />
    </>
    );
};


