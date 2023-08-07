import { useMutation, usePaginatedQuery, useQuery } from "@blitzjs/rpc";
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
    GridRowHeightParams,
    GridRowModel, GridRowModes, GridRowModesModel, GridSortModel, GridToolbarContainer, GridToolbarFilterButton,
    GridToolbarQuickFilter
} from '@mui/x-data-grid';
import React from "react";
import { useBeforeunload } from 'react-beforeunload';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import * as db3client from "./db3Client";
import { DB3NewObjectDialog } from "./db3NewObjectDialog";

const gViewingRowHeight = 40;
const gEditingRowHeight = 55;
const gPageSizeOptions = [20, 50, 100] as number[];
const gPageSizeDefault = 50 as number;

function CustomToolbar<RowModel>({ onNewClicked, table }: { onNewClicked: any, table: db3.xTable<RowModel> }) {
    return (
        <GridToolbarContainer>
            <Button startIcon={<AddIcon />} onClick={onNewClicked}>insert {table.tableName}</Button>

            {/* <GridToolbarColumnsButton /> */}
            <GridToolbarFilterButton />
            {/* <GridToolbarDensitySelector /> */}
            {/* <GridToolbarExport /> */}
            <GridToolbarQuickFilter />
        </GridToolbarContainer>
    );
}

// there is a flow which justifies the use of column pairs in the datagrid to represent both the roleId and role members.
// in short it all comes down to the fact that the temporary editing values of a row edit are managed by the datagrid (and not in the database),
// and thus go through setEditGridCellValue(). And we need to make sure both roleId and role are always available and in sync.
// 1. user is in EDIT mode (so values are not fetched from the DB; they're controlled by the datagrid)
// 2. user selects a new role here
// 3. the datagrid now has the updated roleId (because of setEditCellValue({ id, field, value });)
//    BUT, the "edit cell"'s parent item doesn't have a corrected `role` object; it hasn't been updated.
//    and I'm not sure how to access that edit item.
// so one solution is to create a new column in the datagrid for each object. so there are always column pairs for ID/object.


export type DB3EditGridProps<RowModel> = {
    table: db3.xTable<RowModel>,
};

export function DB3EditGrid<RowModel>({ table }: DB3EditGridProps<RowModel>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    // const [mutator] = useMutation(db3mutations);
    // const [querier, {refetch}] = useQuery();
    // const [paginatedQuerier, {refetch}] = usePaginatedQuery

    // const [updateMutation] = useMutation(spec.UpdateMutation);
    // const [deleteMutation] = useMutation(spec.DeleteMutation) as any[];
    // const [createMutation] = useMutation(spec.CreateMutation);

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({
        page: 0,
        pageSize: gPageSizeDefault,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    // let orderBy = table.DefaultOrderBy;//{ id: "asc" }; // default order
    // if (sortModel && sortModel.length > 0) {
    //     orderBy = { [sortModel[0]!.field]: sortModel[0]!.sort }; // only support 1 ordering (grid does too afaik)
    // } else {
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

    // const [{ items, count }, { refetch }] = usePaginatedQuery(spec.GetPaginatedItemsQuery, {
    //     orderBy,
    //     where,
    //     skip: paginationModel.pageSize * paginationModel.page,
    //     take: paginationModel.pageSize,
    // });

    const tableClient = db3client.useTableRenderContext(table, {
        filterModel, sortModel, paginationModel
    });

    const [rowModesModel, setRowModesModel] = React.useState({});
    const [explicitSave, setExplicitSave] = React.useState(false); // flag to know if the user proactively clicked save, otherwise we consider it implied and requires stronger consent
    const [deleteRowId, setDeleteRowId] = React.useState(null); // needed to display a confirmation dlg

    //console.log(rowModesModel);

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
        console.log(`edit grid 2 : processRowUpdate. newrow, oldrow:`);
        console.log(newRow);
        console.log(oldRow);
        return new Promise<GridRowModel>((resolve, reject) => {
            const validateResult = table.ValidateAndComputeDiff(oldRow as RowModel, newRow as RowModel);
            // there are 3 possible paths:
            // 1. validation errors
            // 2. or, changes made
            // 3. or, no changes
            if (!validateResult.success) {
                // display validation error.
                console.log(`validation error (validateResult):`);
                console.log(validateResult);
                alert(`validation error`);
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
        const { newRow, oldRow, reject, resolve }: { newRow: RowModel, oldRow: RowModel, reject: any, resolve: any } = confirmDialogArgs;
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
            tableClient.doDelete(deleteRowId).then(() => {
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
                open={true}
                onClose={handleNo}
            >
                <DialogTitle>{explicitSave ? "Are you sure?" : "Save your changes?"}</DialogTitle>
                <DialogContent dividers>
                    confirm update...
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleNo}>No</Button>
                    <Button onClick={handleYes}>Yes</Button>
                </DialogActions>
            </Dialog>
        );
    };

    const onAddOK = (obj: RowModel) => {
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

    for (const [fieldName, field] of Object.entries(tableClient.columnClients)) {
        const c: GridColDef = {
            field: field.member,
            headerName: field.label,
            editable: field.isEditableInGrid,
            width: field.cellWidth,
        };
        if (field.GridColProps) {
            Object.assign(c, field.GridColProps);
        }

        columns.push(c);
    }

    columns.push(...fkidColumns,
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            getActions: ({ id }) => {
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
                ];
            },
        });

    //console.log(columns);

    return (<>
        {renderConfirmDialog()}
        {renderDeleteConfirmation()}

        {!!showingNewDialog && <DB3NewObjectDialog
            onCancel={() => { setShowingNewDialog(false); }}
            onOK={onAddOK}
            table={table}
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
                    table: table,
                }
            }}
            getRowHeight={({ id, densityFactor, ...params }: GridRowHeightParams) => {
                //console.log();
                if (rowModesModel[id] && rowModesModel[id].mode === 'edit') {
                    return gEditingRowHeight;
                }
                return gViewingRowHeight;
            }}
            // schema
            columns={columns}

            // actual data
            rows={tableClient.items}
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
            onRowModesModelChange={newRowModesModel => {
                setExplicitSave(false); // this is called before editing, or after saving. so it's safe to reset explicit save flag always here.
                setRowModesModel(newRowModesModel);
            }}
            onProcessRowUpdateError={(error) => { console.error(error) }}
            processRowUpdate={processRowUpdate}
        />
    </>
    );
};


