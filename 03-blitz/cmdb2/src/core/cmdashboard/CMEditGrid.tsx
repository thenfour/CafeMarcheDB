import { useAuthorize } from "@blitzjs/auth";
import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
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
    GridRowModel, GridRowModes, GridRowModesModel, GridSortModel, GridToolbarContainer, GridToolbarFilterButton,
    GridToolbarQuickFilter
} from '@mui/x-data-grid';
import React from "react";
import { useBeforeunload } from 'react-beforeunload';
import { CMGridEditCell } from "src/core/cmdashboard/CMGridEditCell";
import { CMNewObjectDialog } from "src/core/cmdashboard/CMNewObjectDialog";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { CMEditGridColumnType, CMEditGridSpec } from "./CMColumnSpec";

function CustomToolbar({ onNewClicked }) {
    return (
        <GridToolbarContainer>
            <Button startIcon={<AddIcon />} onClick={onNewClicked}>
                New user
            </Button>

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

export type CMEditGridProps<TDBModel> = {
    spec: CMEditGridSpec<TDBModel>,
};

export function CMEditGrid<TDBModel>({ spec }: CMEditGridProps<TDBModel>) {
    useAuthorize();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [updateMutation] = useMutation(spec.UpdateMutation);
    const [deleteMutation] = useMutation(spec.DeleteMutation) as any[];
    const [createMutation] = useMutation(spec.CreateMutation);

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

    const [{ items, count }, { refetch }] = usePaginatedQuery(spec.GetPaginatedItemsQuery, {
        orderBy,
        where,
        skip: paginationModel.pageSize * paginationModel.page,
        take: paginationModel.pageSize,
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

    const processRowUpdate = (newRow: GridRowModel, oldRow: GridRowModel) =>
        new Promise<GridRowModel>((resolve, reject) => {
            const mutation = spec.ComputeDiff(oldRow as TDBModel, newRow as TDBModel);//computeMutation(newRow, oldRow);
            if (mutation) {
                // Save the arguments to resolve or reject the promise later
                setConfirmDialogArgs({ resolve, reject, newRow, oldRow, mutation });
            } else {
                showSnackbar({ children: spec.NoChangesMadeSnackbar(oldRow as TDBModel), severity: 'success' });
                resolve(oldRow); // Nothing was changed
            }
        });

    const [showingNewDialog, setShowingNewDialog] = React.useState<boolean>(false);

    const handleNo = () => {
        const { oldRow, resolve } = confirmDialogArgs;
        resolve(oldRow); // Resolve with the old row to not update the internal state
        setConfirmDialogArgs(null);
    };

    const handleYes = () => {
        const { newRow, oldRow, reject, resolve } = confirmDialogArgs;
        try {
            updateMutation(newRow).then((updatedObj) => {
                showSnackbar({ children: spec.UpdateItemSuccessSnackbar(updatedObj as TDBModel), severity: 'success' });
                void refetch();
            }).catch((reason => {
                showSnackbar({ children: spec.UpdateItemErrorSnackbar(reason), severity: 'error' });
                void refetch(); // should revert the data.
            }));
            resolve(newRow); // optimistic
        } catch (error) {
            showSnackbar({ children: spec.UpdateItemErrorSnackbar(error), severity: 'error' });
            reject(oldRow);
        }
        setConfirmDialogArgs(null);
    };

    const renderDeleteConfirmation = () => {
        if (!deleteRowId) {
            return null;
        }
        const handleYes = () => {
            deleteMutation({ [spec.PKIDMemberName]: deleteRowId });
            setDeleteRowId(null);
        };
        const row = items.find(u => u[spec.PKIDMemberName] == deleteRowId);
        if (!row) { // not found wut? maybe some weird async pagination or background refresh error
            setDeleteRowId(null);
            return null;
        }

        const handleClose = () => setDeleteRowId(null);

        return (
            <Dialog
                open={true}
                onClose={handleClose}
            >
                <DialogTitle>Delete row?</DialogTitle>
                <DialogContent dividers>
                    {spec.DeleteConfirmationMessage(row)}
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

        const { oldRow, newRow, mutation } = confirmDialogArgs;

        return (
            <Dialog
                open={true}
                onClose={handleNo}
            >
                <DialogTitle>{explicitSave ? "Are you sure?" : "Save your changes?"}</DialogTitle>
                <DialogContent dividers>
                    {spec.UpdateConfirmationMessage(oldRow, newRow, mutation)}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleNo}>No</Button>
                    <Button onClick={handleYes}>Yes</Button>
                </DialogActions>
            </Dialog>
        );
    };

    const onAddOK = (obj) => {
        createMutation(obj).then((newRow) => {
            showSnackbar({ children: spec.CreateSuccessSnackbar(newRow as TDBModel), severity: 'success' });
            void refetch();
        }).catch(err => {
            showSnackbar({ children: spec.CreateErrorSnackbar(err), severity: 'error' });
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
    const columns: GridColDef[] = spec.Columns.map(colSpec => {
        switch (colSpec.Behavior) {
            case CMEditGridColumnType.ForeignObject:

                // for each foreign object column, also add the corresponding ID column.
                fkidColumns.push({ field: colSpec.FKIDMemberName!, editable: true, filterable: false });

                return {
                    field: colSpec.MemberName,
                    headerName: colSpec.HeaderText,
                    editable: colSpec.Editable,
                    width: colSpec.Width,
                    renderCell: (params) => {
                        return colSpec.FKRenderViewCell!({ value: params.value });//.SelectItemDialogSpec.RenderItem({ value: params.value });
                    },
                    renderEditCell: (params) => {
                        return <CMGridEditCell spec={colSpec.FKEditCellSpec!} {...params} />;
                    }
                };
            case CMEditGridColumnType.PK:
                return {
                    field: colSpec.MemberName,
                    headerName: colSpec.HeaderText,
                    editable: false,
                    width: colSpec.Width,
                    type: 'number',
                };
            default:
            case CMEditGridColumnType.String:
                return {
                    field: colSpec.MemberName,
                    headerName: colSpec.HeaderText,
                    editable: colSpec.Editable,
                    width: colSpec.Width,
                    type: 'string',
                };

        }
    });

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

        {!!showingNewDialog && <CMNewObjectDialog
            onCancel={() => { setShowingNewDialog(false); }}
            onOK={onAddOK}
            spec={spec.NewItemDialogSpec}
        />}
        <DataGrid
            // basic config
            editMode="row"
            density="compact"
            checkboxSelection
            disableRowSelectionOnClick
            slots={{
                toolbar: CustomToolbar,
            }}
            slotProps={{
                toolbar: {
                    onNewClicked: () => { setShowingNewDialog(true); }
                }
            }}

            // schema
            columns={columns}

            // actual data
            rows={items}
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
