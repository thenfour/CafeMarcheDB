// main features to consider:
// ADDING: let's not add directly in the grid.
//   doing so would result in weirdness wrt paging / sorting /filtering. Better to just display a modal or inline form specifically for adding items.
// EDITING in grid: should not be a problem.
// SERVER-BACKED DATA:
//   not completely trivial because now instead of the grid performing filtering, sorting, pagination, it must be passed to a query.
//  - filtering
//  - sorting
//  - pagination


import { useAuthorize, useSession } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import { usePaginatedQuery } from "@blitzjs/rpc";
import { Backdrop, Box, Button, CircularProgress, Pagination } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import Dashboard2 from "src/core/components/Dashboard2";
import { useCurrentUser } from "src/users/hooks/useCurrentUser";
import getUsers from "src/users/queries/getUsers";
import {
    GridRowModes,
    GridToolbarContainer,
    GridActionsCellItem,
    GridRowEditStopReasons,
} from '@mui/x-data-grid';
//import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import {
    DataGrid, GridRowsProp,
    GridColDef,
    GridToolbarQuickFilter,
    //GridRowData,
    //GridFilterModelState,
    GridToolbar,
    GridSortModel,
    GridFilterModel,
    GridToolbarColumnsButton,
    GridToolbarFilterButton,
    GridToolbarDensitySelector,
    GridToolbarExport,
    //GridSortDirection,
    //GridFilterItem,
    //GridLinkOperator
} from '@mui/x-data-grid';

//const ITEMS_PER_PAGE = 4;

function CustomToolbar() {
    return (
        <GridToolbarContainer>
            {/* <GridToolbarColumnsButton /> */}
            {/* <GridToolbarFilterButton /> */}
            {/* <GridToolbarDensitySelector /> */}
            {/* <GridToolbarExport /> */}
            <GridToolbarQuickFilter />
        </GridToolbarContainer>
    );
}

function EditToolbar(props) {
    const { setRows, setRowModesModel } = props;

    const handleClick = () => {
        // const id = randomId();
        // setRows((oldRows) => [...oldRows, { id, name: '', age: '', isNew: true }]);
        // setRowModesModel((oldModel) => ({
        //     ...oldModel,
        //     [id]: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
        // }));
    };

    return (
        <GridToolbarContainer>
            <Button color="primary" startIcon={<AddIcon />} onClick={handleClick}>
                New user
            </Button>
            <Button color="primary" startIcon={<AddIcon />} onClick={handleClick}>
                Export
            </Button>
            <GridToolbarQuickFilter />
        </GridToolbarContainer>
    );
}


const Inner = () => {
    useAuthorize();
    const currentUser = useCurrentUser();
    const session = useSession();
    const theme = useTheme();
    const router = useRouter();

    // set initial pagination values + get pagination state.
    const [paginationModel, setPaginationModel] = React.useState({
        page: 0,
        pageSize: 3,
    });

    const [sortModel, setSortModel] = React.useState<GridSortModel>([]);
    let orderBy = { id: "asc" }; // default order
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

    //const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    // const goToPreviousPage = () => router.push({ query: { page: page - 1 } });
    // const goToNextPage = () => router.push({ query: { page: page + 1 } });

    // const onPaginationChange = (event: React.ChangeEvent<unknown>, value: number) => {
    //     // mui pagination is 1-based
    //     router.push({ query: { page: (value - 1) } })
    // };

    // React.useEffect(() => {
    //     document.documentElement.style.setProperty('--data-grid-column-header-background-color', "#ccc");
    // }, []);


    // const rows: GridRowsProp = [
    //     { id: 1, col1: 'Hello', col2: 'World' },
    //     { id: 2, col1: 'DataGridPro', col2: 'is Awesome' },
    //     { id: 3, col1: 'MUI', col2: 'is Amazing' },
    // ];

    // Some API clients return undefined while loading
    // Following lines are here to prevent `rowCountState` from being undefined during the loading
    // const [rowCountState, setRowCountState] = React.useState(
    //     pageInfo?.totalRowCount || 0,
    // );
    // React.useEffect(() => {
    //     setRowCountState((prevRowCountState) =>
    //         pageInfo?.totalRowCount !== undefined
    //             ? pageInfo?.totalRowCount
    //             : prevRowCountState,
    //     );
    // }, [pageInfo?.totalRowCount, setRowCountState]);

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'id', flex: 1, },
        { field: 'name', headerName: 'Name', flex: 1, },
        { field: 'email', headerName: 'email', flex: 1, },
        {
            field: 'col2',
            headerName: 'Column 2',
            //width: 150,
            flex: 1,
            valueGetter: (params) => `..${params.row.role || ''}..`,
            renderCell: (params) => (params.value.name),
            renderHeader: (params) => (<Box>column 2</Box>)
        },
    ];

    return (<>
        <DataGrid
            // basic config
            editMode="row"
            checkboxSelection
            disableRowSelectionOnClick
            slots={{
                toolbar: CustomToolbar,//GridToolbar,//EditToolbar,
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
                console.log(`sort model changing to ${JSON.stringify(model)}`);
                setSortModel(model);
            }}

            // filtering
            filterMode="server"
            onFilterModelChange={(model) => {
                console.log(`filter model changing to ${JSON.stringify(model)}`);
                setFilterModel(model);
            }}

        />
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
