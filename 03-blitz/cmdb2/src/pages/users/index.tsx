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
// SERVER-BACKED DATA:
//   not completely trivial because now instead of the grid performing filtering, sorting, pagination, it must be passed to a query.
//  - filtering
//  - sorting
//  - pagination
import { useAuthorize, useSession } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { Backdrop, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Pagination, Stack } from "@mui/material";
import Alert, { AlertProps } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from "@mui/material/styles";
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
import db from "db"

function CustomToolbar() {
    return (
        <GridToolbarContainer>
            <Button startIcon={<AddIcon />} href="/users/add">
                New user
            </Button>
            <GridToolbarColumnsButton />
            <GridToolbarFilterButton />
            {/* <GridToolbarDensitySelector /> */}
            <GridToolbarExport />
            <GridToolbarQuickFilter />
        </GridToolbarContainer>
    );
}

function computeMutation(newRow: GridRowModel, oldRow: GridRowModel) {
    if (newRow.name !== oldRow.name) {
        return `Name from '${oldRow.name}' to '${newRow.name}'`;
    }
    return null;
}

// const cb2 = (user: Partial<User>) => {
//     return new Promise<Partial<User>>((resolve, reject) => {
//         setTimeout(() => {
//             if (user.name?.trim() === '') {
//                 reject();
//             } else {
//                 resolve(user);
//             }
//         }, 200);
//     });
// }

// const useFakeMutation = () => {
//     return React.useCallback(
//         cb2,
//         [],
//     );
// };

// const cb = async () => {
//     return await new Promise((resolve) => {
//         setTimeout(resolve, time);
//     });
// };
// function useDelay(time = 1000) {
//     return React.useCallback(cb, [time]);
// }

// const useMutationWrapper = (mutation) => {
//     return React.useCallback(user =>
//         return await mutation(user);
//         // new Promise<Partial<User>>((resolve, reject) => {
//         //     await mutation();
//         // }),
//         [],
//     );
// };

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const useMutationWrapper = (mutation) => {
    const cb = async (user) => {
        return await mutation(user);
    };
    return React.useCallback(
        cb, // fn to callback
        [], // dependencies
    );
};

const Inner = () => {
    useAuthorize();
    const currentUser = useCurrentUser();
    const session = useSession();
    const theme = useTheme();
    const router = useRouter();

    React.useEffect(() => {
        document.documentElement.style.setProperty('--primary-color', theme.palette.primary.main);
        document.documentElement.style.setProperty('--secondary-color', theme.palette.secondary.main);
    }, []);

    // allow code to invoke the snackbar
    const [snackbar, setSnackbar] = React.useState<Pick<AlertProps, 'children' | 'severity'> | null>(null);
    const [updateUserFromGridMutationRaw] = useMutation(updateUserFromGrid);
    const updateUserFromGridMutation = useMutationWrapper(updateUserFromGridMutationRaw);

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
    //  {"items":[],"quickFilterValues":["c","c","9","+49","\"aoeu\""]}
    let where = {};
    if (filterModel.quickFilterValues) {
        where = {
            AND: filterModel.quickFilterValues.map(q => {
                return { name: { contains: q } };
            })
        }
    }

    const [{ users, hasMore, count }] = usePaginatedQuery(getUsers, {
        orderBy,//: { [sortModel[0].field]: sortModel[0].sort }, // 
        where,
        skip: paginationModel.pageSize * paginationModel.page,
        take: paginationModel.pageSize,
    });

    // console.log(`users: `);
    // console.log(users);


    //const [rows, setRows] = React.useState(initialRows);
    const [rowModesModel, setRowModesModel2] = React.useState({});

    const setRowModesModel = (o) => {
        console.log(`SETTING rowModesModel to: `);
        console.log(o);
        setRowModesModel2(o);
    };
    console.log(`rowModesModel: `);
    console.log(rowModesModel);

    const handleRowEditStop = (params, event) => {
        if (params.reason === GridRowEditStopReasons.rowFocusOut) {
            event.defaultMuiPrevented = true;
        }
    };

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

    const handleRowModesModelChange = (newRowModesModel: GridRowModesModel) => {
        console.log(`handleRowModesModelChange`);
        setRowModesModel(newRowModesModel);
    };

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'id' },
        { field: 'name', headerName: 'Name', editable: true, maxWidth: 350 },
        { field: 'email', headerName: 'email', editable: true, maxWidth: 350 },
        {
            field: 'col2',
            headerName: 'Column 2',
            valueGetter: (params) => {

                console.log(`col2 value getter... row:`);
                console.log(params.row);
                return `..${params.row.role || ''}..`;
            },
            renderCell: (params) => (params.value.name),
            renderHeader: (params) => (<Box color="secondary">column 2</Box>)
        },
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

    const handleYes = async () => {
        const { newRow, oldRow, reject, resolve, mutation } = promiseArguments;
        console.log(`handling yes...`);
        const id = newRow.id;

        try {
            // Make the HTTP request to save in the backend
            const updatedObj = await updateUserFromGridMutation(newRow);
            //await sleep(100);
            console.log(`updateUserFromGridMutation returned; updated object (id: ${id}): `);
            console.log(updatedObj);

            console.log(`resolving...`);
            resolve(updatedObj);
            console.log(`setting promise arguments...`);
            setPromiseArguments(null);

            setSnackbar({ children: 'User successfully saved', severity: 'success' });
            console.log(`and this should be success?`);
        } catch (error) {
            console.log(`updateUserFromGridMutation seems to have thrown exception: ${error}`);
            setSnackbar({ children: "Some server error", severity: 'error' });
            reject(oldRow);
            setPromiseArguments(null);
        }
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

    return (<>
        {renderConfirmDialog()}
        <DataGrid
            // basic config
            editMode="row"
            density="compact"
            checkboxSelection
            disableRowSelectionOnClick
            slots={{
                toolbar: CustomToolbar,//GridToolbar,//EditToolbar,
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
                console.log(`sort model changing to ${JSON.stringify(model)}`);
                setSortModel(model);
            }}

            // filtering
            filterMode="server"
            onFilterModelChange={(model) => {
                console.log(`filter model changing to ${JSON.stringify(model)}`);
                setFilterModel(model);
            }}

            // editing
            rowModesModel={rowModesModel}
            onRowModesModelChange={handleRowModesModelChange}
            onProcessRowUpdateError={(error) => { console.log(error) }}
            onRowEditStop={handleRowEditStop}
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
        <Suspense fallback="loading">
            <Dashboard2>
                <Inner></Inner>
            </Dashboard2>
        </Suspense>
    );
};

export default UserListPage;
