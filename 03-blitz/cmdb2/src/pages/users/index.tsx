// next steps:
// x roles: selecting related item via dropdown
// x quick-creating roles
// x when stopping editing because clicking outside the cell, give cancel option.
// x delete user
// x warn when navigating away while editing
// x select role for new users (autocomplete version)
// - make things generic; use mui existing components as model
// - validation for all fields in all scenarios
// - authorization for pages, components, columns, db queries & mutations
// - fix some flicker problem what is going on?
// - separate signup from google signup from admin create, regarding fields & auth
// - validation show pretty errors
// - other datatypes (boolean, datetime...)

// there are 2 ways to select objects:
// from an edit cell
//   not much space, demanding a dialog which can allow:
//      - seeing more detailed view of all items
//      - filtering & adding new items
//      - with a dialog there's enough space to see ALL options
// from an existing dialog. like creating a new user, select a role for that new user.
//   so we can't show all items, need to find a compact way to do this.
//   mui auto-complete is perfect for this.
//   see https://mui.com/material-ui/react-autocomplete/#creatable

// - support pagination on the [SELECT...] selection dialog.
// main features to consider:
// x snackbar to notify async changes
// x confirmation dialog
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
import { useAuthorize } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import { useMutation, usePaginatedQuery, useQuery } from "@blitzjs/rpc";
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
    Autocomplete,
    Box,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    FormControl,
    InputBase,
    List,
    ListItemButton, ListItemIcon, ListItemText,
    TextField
} from "@mui/material";
import { createFilterOptions } from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
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
import { formatZodError } from "blitz";
import React from "react";
import { useBeforeunload } from 'react-beforeunload';
import CreateRoleMutation from "src/auth/mutations/createRole";
import SoftDeleteUserMutation from "src/auth/mutations/deleteUser";
import NewUserMutationSpec from "src/auth/mutations/signup";
import GetRoleQuery from "src/auth/queries/getRole";
import GetRolesQuery from "src/auth/queries/getRoles";
import { Signup as NewUserSchema } from "src/auth/schemas";
import { CMTextField } from "src/core/cmdashboard/CMTextField";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "src/core/permissions";
import updateUserFromGrid from "src/users/mutations/updateUserFromGrid";
import getUsers from "src/users/queries/getUsers";

// FORM FIELDS
// ValidationTextField = TextField for string, used by new item dialog
// ChipValue = Chip for object, used in various places (edit cell)
// SelectObjectAutocomplete = autocomplete selection with quick add

// CELL VIEWER

// CELL EDITOR
// SelectObjectDialog = modal dialog for selection with quick add, more beautiful ux
// ObjectEditCell

// AddObjectDialog
// CREATE FORM

// EDIT DATAGRID
// EditableGrid

// UpdateConfirmationDialog
// DeleteConfirmationDialog

const RoleSpec = {
};

const gFilterRoles = createFilterOptions();

// autocomplete selection of a single related object
// https://mui.com/material-ui/react-autocomplete/#creatable
// option items are role objects themselves (not just IDs)
function SelectRoleInput({ valueObj, onChange }) {
    const [{ items }, { refetch }] = usePaginatedQuery(GetRolesQuery, { where: {}, orderBy: {} });
    const [createRoleMutation] = useMutation(CreateRoleMutation);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    return (<Autocomplete
        value={valueObj || null} // null to make sure the component acts as a controlled component
        onChange={(event, newValue) => {
            if (typeof newValue === 'string') {
                // when the user types in a value that doesn't exist, and hits enter, this triggers.
                // don't create new, and don't select
            } else if (newValue && newValue.inputValue) {
                // Create a new value from the user input
                createRoleMutation({ name: newValue.inputValue, description: "" }).then((updatedObj) => {
                    showSnackbar({ children: "Role created", severity: "success" });
                    onChange(updatedObj);
                    refetch();
                }).catch((err => {
                    showSnackbar({ children: `Failed to create role: ${err}`, severity: "error" });
                    refetch(); // should revert the data.
                }));
            } else {
                // user selecting a normal item from the dropdown
                onChange(newValue);
            }
        }}
        filterOptions={(options, params) => {
            const filtered = gFilterRoles(options, params);
            const { inputValue } = params;
            // Suggest the creation of a new value
            const isExisting = options.some((option) => inputValue === option.name);
            if (inputValue !== '' && !isExisting) {
                filtered.push({ // push vs. unshift; hard to choose really. but adding to end has the advantage that you are encouraged to select existing items, and the auto-highlighted first option is going to be the existing one rather than creating new.
                    inputValue,
                    name: `Add "${inputValue}"`,
                });
            }
            return filtered;
        }}
        freeSolo
        autoHighlight={true}
        selectOnFocus
        clearOnBlur
        handleHomeEndKeys
        options={items}
        getOptionLabel={(option) => { // it's not completely clear to me what this is used for, considering we render items ourselves.
            // Value selected with enter, right from the input. docs state that for freesolo this case must be handled.
            if (typeof option === 'string') {
                return option;
            }
            // Add the virtual dynamic option
            if (option.inputValue) {
                return option.inputValue;
            }
            // Regular option
            return option.name;
        }}
        renderOption={(props, option) => {
            return option.inputValue ?
                (<li {...props}>
                    <AddIcon />
                    <span style={{ fontStyle: "italic" }}>{option.name}</span>
                </li>) :
                (<li {...props}>
                    <SecurityIcon />
                    {option.name}
                </li>);
        }}
        renderInput={(params) => (
            <TextField {...params} label="Select role" />
        )}
    />
    );
};





// a single read-only value rendered as a <Chip>.
// optionally deleteable
function RoleValue({ roleId, role, onClick = undefined, onValueDelete = undefined }) {

    // when editing, you are really editing the roleId field.
    // but the `role` object might be out-of-sync with the updated value. correction is therefore necessary for rendering the value for edit cells.
    const [correctedRole, setCorrectedRole] = React.useState(role);

    // todo: is this going to query too often?
    const [updatedRole] = useQuery(GetRoleQuery, { id: roleId });
    React.useEffect(() => {
        setCorrectedRole(updatedRole);
    }, [roleId]);

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
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        createRoleMutation({ name: filterText, description: "" }).then((updatedObj) => {
            showSnackbar({ children: 'Role successfully created', severity: 'success' });
            refetch();
        }).catch((err => {
            showSnackbar({ children: `Some server error ${err}`, severity: 'error' });
            refetch(); // should revert the data.
        }));
    };

    const handleItemClick = (e, clickedRoleId) => {
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

    if (props.cellMode != GridCellModes.Edit) {
        return <RoleValue roleId={props?.row?.roleId} role={props?.row?.role}></RoleValue>; //props.colDef.renderCell(props);
    }
    //const { id, value, field } = params;
    if (showingRoleSelectDialog) {
        return <SelectRoleDialog roleId={value} onCancel={() => { setShowingRoleSelectDialog(false) }} onOK={(newRoleId, newRole) => {
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
    const [validationErrors, setValidationErrors] = React.useState({}); // don't allow null for syntax simplicity

    React.useEffect(() => {
        //debugger;
        NewUserSchema.safeParseAsync(obj).then((res) => {
            //console.log(`Parsed schema... result:`);
            //console.log(res);
            if (!res.error) {
                setValidationErrors({});
                return;
            }
            setValidationErrors(formatZodError(res.error));
            //const [errorText] = Object.values(formatZodError(res.error));
            //setErrorText(res.success ? null : (errorText || "Invalid value"));
        });
    }, [obj]);

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
                    <CMTextField label="Name" validationError={validationErrors["name"]} value={obj["name"]} onChange={(e, val) => {
                        setObj({ ...obj, name: val });
                    }}
                        autoFocus={true}></CMTextField>
                    <CMTextField label="Email" validationError={validationErrors["email"]} value={obj["email"]} onChange={(e, val) => {
                        setObj({ ...obj, email: val });
                    }}
                        autoFocus={false}></CMTextField>
                    <SelectRoleInput valueObj={obj.role} onChange={(role) => {
                        setObj({ ...obj, role, roleId: (role?.id || null) });
                    }}></SelectRoleInput>
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
    // const currentUser = useCurrentUser();
    // const session = useSession();
    // const theme = useTheme();
    // const router = useRouter();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    // allow code to invoke the snackbar
    //const [snackbar, setSnackbar] = React.useState<Pick<AlertProps, 'children' | 'severity'> | null>(null);
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
        setExplicitSave(true);
        setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
    };

    const [deleteRowId, setDeleteRowId] = React.useState(null);

    const handleDeleteClick = (id) => () => {
        setDeleteRowId(id);
    };

    const handleCancelClick = (id) => () => {
        setRowModesModel({
            ...rowModesModel,
            [id]: { mode: GridRowModes.View, ignoreModifications: true },
        });
    };

    const [promiseArguments, setPromiseArguments] = React.useState<any>(null);

    const processRowUpdate = // previously used // const processRowUpdate = React.useCallback( but i don't quite get why.
        (newRow: GridRowModel, oldRow: GridRowModel) =>
            new Promise<GridRowModel>((resolve, reject) => {
                const mutation = computeMutation(newRow, oldRow);
                if (mutation) {
                    // Save the arguments to resolve or reject the promise later
                    setPromiseArguments({ resolve, reject, newRow, oldRow, mutation });
                } else {
                    showSnackbar({ children: "No changes were made", severity: 'success' });
                    resolve(oldRow); // Nothing was changed
                }
            });

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
                showSnackbar({ children: 'User successfully saved', severity: 'success' });
                refetch();
            }).catch((reason => {
                showSnackbar({ children: "Some server error", severity: 'error' });
                refetch(); // should revert the data.
            }));
            resolve(newRow); // optimistic
        } catch (error) {
            showSnackbar({ children: "Some server error", severity: 'error' });
            reject(oldRow);
        }
        setPromiseArguments(null);
    };

    const [softDeleteUserMutation] = useMutation(SoftDeleteUserMutation);

    const renderDeleteConfirmation = () => {
        if (!deleteRowId) {
            return null;
        }
        const handleYes = () => {
            softDeleteUserMutation({ id: deleteRowId });
            setDeleteRowId(null);
        };
        const row = users.find(u => u.id == deleteRowId);
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
                    Pressing 'Yes' will delete this row with name {row.name}.
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleYes}>Yes</Button>
                </DialogActions>
            </Dialog>
        );
    };

    const renderConfirmDialog = () => {
        if (!promiseArguments) {
            return null;
        }

        const { mutation } = promiseArguments;

        return (
            <Dialog
                open={true}
                onClose={handleNo}
            >
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
        console.log(`about to add new user with role ID ${obj.roleId}`);
        newUserMutation(obj).then(() => {
            showSnackbar({ children: 'New user success', severity: 'success' });
            refetch();
        }).catch(err => {
            showSnackbar({ children: "Some server error when adding", severity: 'error' });
        });
        setShowingNewDialog(false);
    };

    const initialObj = {
        name: "",
        email: "",
        password: "1234567890!@#$%^&aoeuAOEU",
    };


    const isAnyRowEdited = (rowModels) => {
        for (const rowModel of Object.values(rowModels)) {
            if (rowModel.mode === GridRowModes.Edit) {
                return true;
            }
        }
        return false;
    };

    const isDirty = !!showingNewDialog || isAnyRowEdited(rowModesModel);

    useBeforeunload(isDirty ? (event) => event.preventDefault() : null);

    return (<>
        {renderConfirmDialog()}
        {renderDeleteConfirmation()}

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
                setExplicitSave(false); // this is called before editing, or after saving. so it's safe to reset explicit save flag always here.
                setRowModesModel(newRowModesModel);
            }}
            onProcessRowUpdateError={(error) => { console.error(error) }}
            processRowUpdate={processRowUpdate}
        />
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

UserListPage.authenticate = { role: [Permission.can_edit_users] };

export default UserListPage;
