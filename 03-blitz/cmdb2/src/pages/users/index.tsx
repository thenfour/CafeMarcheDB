// main features to consider:
// snackbar to notify async changes
// confirmation dialog
// properly handle server-side errors
// validation based on schema. (see validateZodSchema)
// authorization for viewing, editing (by column), adding, deleting
// ADDING: let's not add directly in the grid.
//   doing so would result in weirdness wrt paging / sorting /filtering. Better to just display a modal or inline form specifically for adding items.
//   grid is just not a great UI regarding validation etc. better for modifying existing fields
// EDITING in grid: should not be a problem.
// DELETING
//   esp. for users, i think i should not actually cascade delete users. probably just mark users as inactive
// JOURNALING / AUDIT TRACING
//   register every mutation in a journal
// SERVER-BACKED DATA:
//   not completely trivial because now instead of the grid performing filtering, sorting, pagination, it must be passed to a query.
//  - filtering
//  - sorting
//  - pagination
// RESPONSIVE
//   list of cards feels the most useful: https://github.com/mui/mui-x/issues/6460#issuecomment-1409912710
// FILTERING
//   stuff like freeform text + tag text or something may require custom
import { useAuthorize, useSession } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { Backdrop, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, IconButton, Pagination, Stack, TextField } from "@mui/material";
import Alert, { AlertProps } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import {
    DataGrid,
    GridActionsCellItem,
    GridColDef,
    GridFilterModel,
    GridRowEditStopReasons,
    GridRowModel,
    GridRowModesModel,
    GridRowModes,
    GridRowsProp,
    GridSortModel,
    GridToolbar,
    GridToolbarColumnsButton,
    GridToolbarContainer,
    GridToolbarDensitySelector,
    GridToolbarExport,
    GridToolbarFilterButton,
    GridToolbarQuickFilter,
} from '@mui/x-data-grid';
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import Dashboard2 from "src/core/components/Dashboard2";
import { useCurrentUser } from "src/users/hooks/useCurrentUser";
import updateUserFromGrid from "src/users/mutations/updateUserFromGrid";
import getUsers from "src/users/queries/getUsers";
//import db from "db"
import { Signup as NewUserSchema } from "src/auth/schemas"
import NewUserMutationSpec from "src/auth/mutations/signup"
import DashboardLayout from "src/core/layouts/DashboardLayout";

function ValidationTextField({ schema, field, label, obj, onChange, autoFocus }) {
    const [text, setText] = React.useState(obj[field]);
    const [errorText, setErrorText] = React.useState<string | null>(null);

    React.useEffect(() => {
        const inp = { [field]: text };
        schema.pick({ [field]: true }).safeParseAsync(inp).then((res) => {
            setErrorText(res.success ? null : "error");
        });
    }, [text]);

    return (
        <TextField
            id={field}
            autoFocus={autoFocus}
            label={label}
            error={!!errorText}
            helperText={errorText}
            onChange={(e) => { setText(e.target.value); onChange(e); }}
            value={text}
            margin="dense"
            type="text"
            fullWidth
            variant="filled"
            inputProps={{
                'data-lpignore': true, // supposedly prevent lastpass from auto-completing. doesn't work for me tho
            }}
        />
    );
}

function AddUserDialog({ onOK, onCancel, initialObj }) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(initialObj);

    const handleOK = (e) => {
        onOK(obj);
    };

    return (
        <Dialog
            open={true}
            onClose={onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>New user</DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    To subscribe to this website, please enter your email address here. We
                    will send updates occasionally.
                </DialogContentText>
                <FormControl>
                    <ValidationTextField field="name" label="Name" schema={NewUserSchema} obj={obj} onChange={(e) => {
                        obj["name"] = e.target.value;
                        console.log(obj);
                        setObj(obj);
                    }}
                        autoFocus={true}></ValidationTextField>
                    <ValidationTextField field="email" label="Email" schema={NewUserSchema} obj={obj} onChange={(e) => {
                        obj["email"] = e.target.value;
                        console.log(obj);
                        setObj(obj);
                    }}
                        autoFocus={false}></ValidationTextField>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={handleOK}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}

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

// todo: the main point of this is to return whether the data has changed or not.
// as a side-effect, it can also therefore show WHAT changed. whether this is useful or not remains to be seen.
// if so, structure it better.
function computeMutation(newRow: GridRowModel, oldRow: GridRowModel) {
    if (newRow.name !== oldRow.name) {
        return `name changed'`;
    }
    if (newRow.email !== oldRow.email) {
        return `email changed`;
    }
    if (newRow.role !== oldRow.role) {
        return `role changed`;
    }
    return null;
}

const UserGrid = () => {
    useAuthorize();
    const currentUser = useCurrentUser();
    const session = useSession();
    const theme = useTheme();
    const router = useRouter();

    // allow code to invoke the snackbar
    const [snackbar, setSnackbar] = React.useState<Pick<AlertProps, 'children' | 'severity'> | null>(null);
    const [updateUserFromGridMutation] = useMutation(updateUserFromGrid);

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState({
        page: 0,
        pageSize: 3,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    let orderBy: any = { id: "asc" }; // default order
    if (sortModel && sortModel.length > 0) {
        orderBy = { [sortModel[0].field]: sortModel[0].sort }; // only support 1 ordering (grid does too afaik)
    }

    const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });
    const where = { AND: [] };
    if (filterModel.quickFilterValues) {
        const quickFilterItems = filterModel.quickFilterValues.map(q => {
            return {
                OR: [
                    { name: { contains: q } },
                    { email: { contains: q } },
                ]
            };
        });
        where.AND.push(...quickFilterItems);
    }
    if (filterModel.items && filterModel.items.length > 0) {
        // convert items to prisma filter
        // TODO: fuzzier search using LIKE "%t%o%k%e%n%"
        const filterItems = filterModel.items.map((i) => {
            return { [i.field]: { [i.operator]: i.value } }
        });
        where.AND.push(...filterItems);
    }

    const [{ users, hasMore, count }, { refetch }] = usePaginatedQuery(getUsers, {
        orderBy,
        where,
        skip: paginationModel.pageSize * paginationModel.page,
        take: paginationModel.pageSize,
    });

    const [rowModesModel, setRowModesModel] = React.useState({});

    const handleEditClick = (id) => () => {
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
    };

    const handleSaveClick = (id) => () => {
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
    };

    const handleDeleteClick = (id) => () => {
        //setRows(rows.filter((row) => row.id !== id));
    };

    const handleCancelClick = (id) => () => {
        setRowModesModel({
            ...rowModesModel,
            [id]: { mode: GridRowModes.View, ignoreModifications: true },
        });
    };

    const [promiseArguments, setPromiseArguments] = React.useState<any>(null);

    const processRowUpdate = React.useCallback(
        (newRow: GridRowModel, oldRow: GridRowModel) =>
            new Promise<GridRowModel>((resolve, reject) => {
                const mutation = computeMutation(newRow, oldRow);
                if (mutation) {
                    // Save the arguments to resolve or reject the promise later
                    setPromiseArguments({ resolve, reject, newRow, oldRow, mutation });
                } else {
                    resolve(oldRow); // Nothing was changed
                }
            }),
        [],
    );

    const [showingNewDialog, setShowingNewDialog] = React.useState<boolean>(false);
    //AddUserDialog

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'id' },
        { field: 'name', headerName: 'Name', editable: true, width: 150 },
        { field: 'email', headerName: 'email', editable: true, width: 150 },
        { field: 'role', headerName: 'role', editable: true, width: 150 },
        {
            field: 'actions',
            type: 'actions',
            headerName: 'Actions',
            getActions: ({ id }) => {
                const isInEditMode = rowModesModel[id]?.mode === GridRowModes.Edit;

                if (isInEditMode) {
                    return [
                        <GridActionsCellItem
                            icon={<SaveIcon className="hoverActionIcon" />}
                            label="Save"
                            onClick={handleSaveClick(id)}
                        />,
                        <GridActionsCellItem
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
                        label="Edit"
                        onClick={handleEditClick(id)}
                        color="inherit"
                    //showInMenu={true} // allows showing actions in a menu.
                    // cellClassName
                    />,
                    <GridActionsCellItem
                        icon={<DeleteIcon className="hoverActionIcon" />}
                        label="Delete"
                        onClick={handleDeleteClick(id)}
                        color="inherit"
                    />,
                ];
            },
        },

    ];

    const handleNo = () => {
        const { oldRow, resolve } = promiseArguments;
        resolve(oldRow); // Resolve with the old row to not update the internal state
        setPromiseArguments(null);
    };

    const handleYes = () => {
        const { newRow, oldRow, reject, resolve, mutation } = promiseArguments;
        try {
            updateUserFromGridMutation(newRow).then((updatedObj) => {
                setSnackbar({ children: 'User successfully saved', severity: 'success' });
                refetch();
            }).catch((reason => {
                setSnackbar({ children: "Some server error", severity: 'error' });
                refetch(); // should revert the data.
            }));
            resolve(newRow); // optimistic
        } catch (error) {
            setSnackbar({ children: "Some server error", severity: 'error' });
            reject(oldRow);
        }
        setPromiseArguments(null);
    };

    const renderConfirmDialog = () => {
        if (!promiseArguments) {
            return null;
        }

        const { mutation } = promiseArguments;

        return (
            <Dialog open={true}>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogContent dividers>
                    {`Pressing 'Yes' will change ${mutation}.`}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleNo}>No</Button>
                    <Button onClick={handleYes}>Yes</Button>
                </DialogActions>
            </Dialog>
        );
    };

    const [newUserMutation] = useMutation(NewUserMutationSpec);

    const onAddUserOK = (obj) => {
        newUserMutation(obj).then(() => {
            setSnackbar({ children: 'New user success', severity: 'success' });
            //newUserActions.refetch();
            refetch();
        }).catch(err => {
            setSnackbar({ children: "Some server error when adding", severity: 'error' });
        });
        setShowingNewDialog(false);
    };

    const initialObj = {
        name: "",
        email: "",
        password: "1234567890!@#$%^&aoeuAOEU",
    };

    return (<>
        {renderConfirmDialog()}
        {!!showingNewDialog && <AddUserDialog
            onCancel={() => { setShowingNewDialog(false); }}
            onOK={onAddUserOK}
            initialObj={initialObj}
        ></AddUserDialog>}
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
            //getRowClassName={(params) => `super-app-theme--${params.row.status}`}

            // schema
            columns={columns}

            // actual data
            rows={users}
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
            pageSizeOptions={[3, 10, 25]}

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
            onRowModesModelChange={newRowModesModel => { setRowModesModel(newRowModesModel) }}
            onProcessRowUpdateError={(error) => { console.error(error) }}
            processRowUpdate={processRowUpdate}
        />
        {!!snackbar && (
            <Snackbar open onClose={() => setSnackbar(null)} autoHideDuration={6000}>
                <Alert {...snackbar} onClose={() => setSnackbar(null)} />
            </Snackbar>
        )}
    </>
    );
};

const UserListPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Users">
            <UserGrid></UserGrid>
        </DashboardLayout>
    );
};

UserListPage.authenticate = { role: ["hello?"] };

export default UserListPage;
