// next steps:
// x roles: selecting related item via dropdown
// x quick-creating roles
// x when stopping editing because clicking outside the cell, give cancel option.
// - delete user
// - warn when navigating away while editing

// OK qusetion for the roles dialog: when selecting a related field, we need a list.
// but do we suppport pagination filtering etc? i feel like yes it should.
// so it's already time to do this?

// main features to consider:
// x snackbar to notify async changes
// x confirmation dialog
// - properly handle server-side errors
// - validation based on schema. (see validateZodSchema)
// - authorization for viewing, editing (by column), adding, deleting
// ADDING: let's not add directly in the grid.
//   doing so would result in weirdness wrt paging / sorting /filtering. Better to just display a modal or inline form specifically for adding items.
//   grid is just not a great UI regarding validation etc. better for modifying existing fields
// EDITING in grid: should not be a problem.
// DELETING
//   esp. for users, i think i should not actually cascade delete users. probably just mark users as inactive
// JOURNALING / AUDIT TRACING
//   register every mutation in a journal - done at the mutation level, not here in a datagrid.
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
import { useMutation, useQuery, usePaginatedQuery } from "@blitzjs/rpc";
import {
    Add as AddIcon,
    Close as CancelIcon,
    DeleteOutlined as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Search as SearchIcon,
    Security as SecurityIcon,
} from '@mui/icons-material';

import {
    Box,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    FormControl,
    InputBase,
    List,
    ListItemButton, ListItemIcon, ListItemText,
    TextField
} from "@mui/material";
import Alert, { AlertProps } from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import {
    DataGrid,
    GridActionsCellItem,
    GridCellModes,
    GridColDef,
    GridFilterModel,
    GridRenderEditCellParams, GridRowModel, GridRowModes, GridSortModel, GridToolbarContainer, GridToolbarFilterButton,
    GridToolbarQuickFilter,
    useGridApiContext
} from '@mui/x-data-grid';
import { useRouter } from "next/router";
import React from "react";
import NewUserMutationSpec from "src/auth/mutations/signup";
import { Signup as NewUserSchema } from "src/auth/schemas";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { useCurrentUser } from "src/users/hooks/useCurrentUser";
import updateUserFromGrid from "src/users/mutations/updateUserFromGrid";
import getUsers from "src/users/queries/getUsers";
import CreateRoleMutation from "src/auth/mutations/createRole";
import GetRolesQuery from "src/auth/queries/getRoles";
import GetRoleQuery from "src/auth/queries/getRole";
import { userInfo } from "os";

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

function RoleValue({ roleId, role, onClick = undefined, onValueDelete = undefined }) {

    // when editing, you are really editing the roleId field.
    // but the `role` object might be out-of-sync with the updated value. correction is therefore necessary for rendering the value for edit cells.
    const [correctedRole, setCorrectedRole] = React.useState(role);

    // todo: is this going to query too often?
    const [updatedRole] = useQuery(GetRoleQuery, { id: roleId });
    React.useEffect(() => {
        setCorrectedRole(updatedRole);
    }, [roleId]);

    //console.log(`<RoleValue; roleId=${roleId}; roleName=${role?.name}; correctedName=${correctedRole?.name}`);

    let handleClick: any = null;
    if (onClick) {
        handleClick = (e) => onClick(e, correctedRole);
    }
    let handleDelete: any = null;
    if (onValueDelete) {
        handleDelete = (e) => onValueDelete(e, correctedRole);
    }

    return !!correctedRole ?
        (<Chip size="small" label={correctedRole?.name} onClick={handleClick} onDelete={handleDelete}></Chip>) :
        (<Chip size="small" label={"none"} variant="outlined" onClick={handleClick} sx={{ fontStyle: "italic" }}></Chip>);
}

function SelectRoleDialog({ roleId, onOK, onCancel }) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedValue, setSelectedValue] = React.useState(roleId);
    const [filterText, setFilterText] = React.useState("");

    const where = { AND: [] };
    if (filterText?.length) {
        const tokens = filterText.split(/\s+/).filter(token => token.length > 0);
        const quickFilterItems = tokens.map(q => {
            return {
                OR: [
                    { name: { contains: q } },
                    { description: { contains: q } },
                ]
            };
        });
        where.AND.push(...quickFilterItems);
    }

    const [{ items }, { refetch }] = usePaginatedQuery(GetRolesQuery, { where, orderBy: {} });

    const selectedRole = items.find((r) => r.id == selectedValue);

    const [createRoleMutation] = useMutation(CreateRoleMutation);

    const onNewClicked = (e) => {
        createRoleMutation({ name: filterText, description: "" }).then((updatedObj) => {
            //setSnackbar({ children: 'Role successfully created', severity: 'success' });
            refetch();
        }).catch((reason => {
            //setSnackbar({ children: "Some server error", severity: 'error' });
            refetch(); // should revert the data.
        }));
    };

    const handleItemClick = (e, clickedRoleId) => {
        //console.log(`handleItemClick ${clickedRoleId}`);
        setSelectedValue(clickedRoleId);
    };

    return (
        <Dialog
            open={true}
            onClose={onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>Role</DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    To subscribe to this website, please enter your email address here. We
                    will send updates occasionally.
                </DialogContentText>

                <Box sx={{ p: 2 }}>
                    Selected: <RoleValue roleId={selectedRole?.id} role={selectedRole} onValueDelete={(e, role) => { setSelectedValue(null); }}></RoleValue>
                </Box>

                <Box>
                    <InputBase
                        size="small"
                        placeholder="Filter"
                        sx={{
                            backgroundColor: "#f0f0f0",
                            borderRadius: 3,
                        }}
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        startAdornment={<SearchIcon />}
                    />
                </Box>

                {
                    !!filterText && (
                        <Box><Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={onNewClicked}
                        >
                            Create role "{filterText}"
                        </Button>
                        </Box>
                    )
                }

                {
                    (items.length == 0) ?
                        <Box>Nothing here</Box>
                        :
                        <List>
                            {
                                items.map(item =>
                                (
                                    <React.Fragment key={item.id}>
                                        <ListItemButton selected={item.id == selectedValue} onClick={e => handleItemClick(e, item.id)}>
                                            <ListItemIcon>
                                                <SecurityIcon />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.name}
                                                secondary={item.description}
                                            />
                                        </ListItemButton>
                                        <Divider></Divider>
                                    </React.Fragment>
                                )

                                )

                            }
                        </List>
                }

            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={() => { onOK(selectedValue, selectedRole) }}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}

function RoleEditCell(props: GridRenderEditCellParams) {
    const { id, value, field } = props;
    const apiRef = useGridApiContext();
    const [showingRoleSelectDialog, setShowingRoleSelectDialog] = React.useState<boolean>(false);

    // when viewing, it's just a chip, no click or delete.
    // when editing but not in focus, same thing
    // when editing with focus, show a dropdown menu, with options to delete & create new.
    //console.log(`rendering edit cell; roleID: ${props?.row?.roleId}; row=${props?.row}; role=${props?.row?.role} name=${props?.row?.role?.name}`);

    if (props.cellMode != GridCellModes.Edit || !props.hasFocus) {
        return <RoleValue roleId={props?.row?.roleId} role={props?.row?.role}></RoleValue>; //props.colDef.renderCell(props);
    }
    //const { id, value, field } = params;
    if (showingRoleSelectDialog) {
        return <SelectRoleDialog roleId={value} onCancel={() => { setShowingRoleSelectDialog(false) }} onOK={(newRoleId, newRole) => {
            //console.log(`you clicked on a new ${field}: ${newRoleId}`);
            apiRef.current.setEditCellValue({ id, field, value: newRoleId });
            setShowingRoleSelectDialog(false);
        }}></SelectRoleDialog>;
    }
    return <>{<RoleValue roleId={props?.row?.roleId} role={props?.row?.role}></RoleValue>}<Button onClick={() => { setShowingRoleSelectDialog(true) }}>
        Select...
    </Button>
    </>;
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
                        //console.log(obj);
                        setObj(obj);
                    }}
                        autoFocus={true}></ValidationTextField>
                    <ValidationTextField field="email" label="Email" schema={NewUserSchema} obj={obj} onChange={(e) => {
                        obj["email"] = e.target.value;
                        //console.log(obj);
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
};

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
    if (newRow.roleId !== oldRow.roleId) {
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
    const [explicitSave, setExplicitSave] = React.useState(false);

    const handleEditClick = (id) => () => {
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
    };

    const handleSaveClick = (id) => () => {
        console.log(`handleSaveClick. explicitSave = true`);
        setExplicitSave(true);
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
        console.log(` -> row modes model should have changed right?`);
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

    const processRowUpdate =
        (newRow: GridRowModel, oldRow: GridRowModel) =>
            new Promise<GridRowModel>((resolve, reject) => {
                const mutation = computeMutation(newRow, oldRow);
                if (mutation) {
                    // Save the arguments to resolve or reject the promise later
                    console.log(`process row update - ask user confirm; explicitSave = ${explicitSave}`);
                    setPromiseArguments({ resolve, reject, newRow, oldRow, mutation });
                } else {
                    resolve(oldRow); // Nothing was changed
                }
            });

    // const processRowUpdate = React.useCallback(
    //     (newRow: GridRowModel, oldRow: GridRowModel) =>
    //         new Promise<GridRowModel>((resolve, reject) => {
    //             const mutation = computeMutation(newRow, oldRow);
    //             if (mutation) {
    //                 // Save the arguments to resolve or reject the promise later
    //                 console.log(`process row update - ask user confirm; explicitSave = ${explicitSave}`);
    //                 setPromiseArguments({ resolve, reject, newRow, oldRow, mutation });
    //             } else {
    //                 resolve(oldRow); // Nothing was changed
    //             }
    //         }),
    //     [],
    // );

    const [showingNewDialog, setShowingNewDialog] = React.useState<boolean>(false);

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'id' },
        { field: 'name', headerName: 'Name', editable: true, width: 150 },
        { field: 'email', headerName: 'email', editable: true, width: 150 },
        {
            field: 'roleId',
            headerName: 'role',
            editable: true,
            width: 150,
            renderCell: (params) => {
                //console.log(`rendering value cell; roleID: ${params?.row?.roleId}`);
                return <RoleValue roleId={params?.row?.roleId} role={params?.row?.role}></RoleValue>;
            },
            renderEditCell: (params) => {
                return <RoleEditCell {...params} />;
            }
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
                <DialogTitle>{explicitSave ? "Are you sure?" : "Save your changes?"}</DialogTitle>
                <DialogContent dividers>
                    {`Pressing 'Yes' will change ${mutation}.`}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleNo}>{explicitSave ? "No" : "Cancel"}</Button>
                    <Button onClick={handleYes}>Yes</Button>
                </DialogActions>
            </Dialog>
        );
    };

    const [newUserMutation] = useMutation(NewUserMutationSpec);

    const onAddUserOK = (obj) => {
        newUserMutation(obj).then(() => {
            setSnackbar({ children: 'New user success', severity: 'success' });
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
            onRowModesModelChange={newRowModesModel => {
                console.log(`row modes model change. explicitSave = false`);
                setExplicitSave(false); // this is called before editing, or after saving. so it's safe to reset explicit save flag always here.
                setRowModesModel(newRowModesModel);
            }}
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
