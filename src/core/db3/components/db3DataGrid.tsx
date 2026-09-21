import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";

import { TAnyModel } from '@/shared/rootroot';
import { AgeRelativeToNow } from '@components/DateTime/RelativeTimeComponents';
import {
    Add as AddIcon,
    Close as CancelIcon,
    //DateRange,
    DeleteOutlined as DeleteIcon,
    Edit as EditIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import {
    DataGrid,
    GridActionsCellItem,
    type GridColDef,
    type GridFilterModel,
    type GridPaginationModel,
    type GridRowModel, GridRowModes, type GridRowModesModel, type GridSortModel, GridToolbarContainer, GridToolbarFilterButton,
    GridToolbarQuickFilter
} from '@mui/x-data-grid';
import React from "react";
import { useBeforeunload } from 'react-beforeunload';
import { CoerceToBoolean } from 'shared/utils';
import { CMDialog } from 'src/core/components/CMDialog';
import { AdminInspectObject, CMButton, CMButtonGroup, KeyValueTable } from 'src/core/components/CMCoreComponents2';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { useDashboardContext } from '../../components/dashboardContext/DashboardContext';
import * as DB3Client from "../DB3Client";
import * as db3 from '../db3';
import { gIconMap } from './IconMap';
import { DB3NewObjectDialog } from "./db3NewObjectDialog";
import { z } from "zod";

const gPageSizeOptions = [10, 25, 50, 100, 250, 500] as number[];
const gPageSizeDefault = 50 as number;

interface ClipboardControlsProps {
    client: DB3Client.xTableRenderClient<any, any>;
};

const ClipboardControls = (props: ClipboardControlsProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onCopy = async () => {
        const rows = props.client.items.map(row => {
            const x = props.client.prepareInsertMutation(row);
            const { localFields, ..._ } = db3.separateMutationValues({ table: props.client.schema, fields: x });
            return localFields;
        });

        const txt = JSON.stringify(rows, null, 2);
        console.log(rows);
        await navigator.clipboard.writeText(txt);
        showSnackbar({ severity: "success", children: `Copied ${rows.length} settings to clipboard (${txt.length} characters)` });
    };

    return <CMButton onClick={onCopy} startIcon={gIconMap.ContentCopy()}>Copy for seeding</CMButton>
}






function CustomToolbar({ onNewClicked, tableSpec, disableCreate }: {
    onNewClicked: any,
    tableSpec: DB3Client.xTableClientSpec<any>,
    disableCreate?: boolean,
}) {
    return (
        <GridToolbarContainer>
            {!disableCreate && <CMButton startIcon={<AddIcon />} onClick={onNewClicked}>
                insert {tableSpec.args.table.tableName}
            </CMButton>}

            {/* <GridToolbarColumnsButton /> */}
            <GridToolbarFilterButton />
            {/* <GridToolbarDensitySelector /> */}
            {/* <GridToolbarExport /> */}
            <GridToolbarQuickFilter />
        </GridToolbarContainer>
    );
}

export interface DB3EditGridExtraActionsArgs<TRow extends TAnyModel = TAnyModel> {
    row: TRow,
    refetch: () => void;
};

type DB3EditGridBaseProps<
    TRow extends TAnyModel = TAnyModel,
    TClient extends DB3Client.xTableRenderClient<any, any> = DB3Client.xLegacyTableRenderClient,
> = {
    tableSpec: DB3Client.xTableClientSpec<any>,
    renderExtraActions?: (args: DB3EditGridExtraActionsArgs<TRow>) => React.ReactNode,
    tableParams?: TAnyModel,
    readOnly?: boolean,
    defaultSortModel?: GridSortModel,
    includeDeleted?: boolean,
    disableCreate?: boolean,
    onUpdateRow?: (newRow: TRow, oldRow: TRow, client: TClient) => Promise<TRow>;
    isCellEditable?: (row: TRow, field: string) => boolean;
};

type DB3CrudEditGridProps<TView extends db3.AnyDB3CrudView> =
    DB3EditGridBaseProps<db3.ClientOf<TView>, DB3Client.CrudTableRenderContext<TView>> & {
        view: TView;
        tableSpec: DB3Client.xTableClientSpec<TView>;
    };

type DB3ReadOnlyGridProps = DB3EditGridBaseProps & {
    readOnly: true;
};

export type DB3EditGridProps<TView extends db3.AnyDB3CrudView = db3.AnyDB3CrudView> =
    DB3CrudEditGridProps<TView> | DB3ReadOnlyGridProps;

// default sort model should be determined by the table spec.
// but those are prisma orderby clauses... make  a crude attempt to convert.
// for example,
// export const CustomLinkNaturalOrderBy: Prisma.CustomLinkOrderByWithRelationInput[] = [
//     { createdAt: 'desc' },
// ];

// order by clause can also be nested; we should ignore them.
const PrismaOrderByBasicSchema = z.array(
    z.record(
        z.string(),
        z.any(),
    )
);

function gridSortModelFromPrismaOrderBy(tableSpec: DB3Client.xTableClientSpec<any>): GridSortModel {
    const prismaOrderBy = tableSpec.args.table.naturalOrderBy;
    if (!prismaOrderBy) {
        console.warn("No natural order by specified in table spec.");
        return [];  // no better we can do; this doesn't sort the table.
    }

    // assume the simplest example as above; bail if it doesn't match the table structure.
    const parseResult = PrismaOrderByBasicSchema.safeParse(prismaOrderBy);
    if (!parseResult.success) {
        console.log("Failed to parse natural order by from table spec.", parseResult.error, prismaOrderBy);
        return [];
    }

    // find the first matching order by clause that works for us.
    for (const order of parseResult.data) {
        const field = Object.keys(order)[0];
        if ((!field)) continue;
        const direction = order[field];
        if (direction !== "asc" && direction !== "desc") continue;
        if (field && direction && tableSpec.args.table.columns.some(col => col.member === field)) {
            return [{ field, sort: direction }];
        }
    }

    console.warn("Natural order by did not produce a valid grid sort model.");
    return [];  // fallback if no suitable order by clause is found.
}

function useDB3EditGridQueryState(
    tableSpec: DB3Client.xTableClientSpec<any>,
    props: Pick<
        DB3EditGridBaseProps<any, any>,
        "defaultSortModel" | "includeDeleted"
    >,
) {
    const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({
        page: 0,
        pageSize: gPageSizeDefault,
    });

    const [isWaitingForRefresh, setIsWaitingForRefresh] = React.useState<boolean>(false);
    const [sortModel, setSortModel] = React.useState<GridSortModel>(() => {
        if (props.defaultSortModel) return props.defaultSortModel;
        if (tableSpec.args.table.naturalOrderBy) {
            return gridSortModelFromPrismaOrderBy(tableSpec);
        }
        return [];
    });
    const [filterModel, setFilterModel] = React.useState<GridFilterModel>({ items: [] });

    const publicData = useDB3Authorization();
    const canRecoverDeletedRows = tableSpec.args.table.authorizeIncludeDeleted(publicData, true);
    const includeDeleted = props.includeDeleted ?? canRecoverDeletedRows;
    return {
        paginationModel,
        setPaginationModel,
        sortModel,
        setSortModel,
        filterModel,
        setFilterModel,
        publicData,
        includeDeleted,
    };
}

type DB3EditGridQueryState = ReturnType<typeof useDB3EditGridQueryState>;

export function DB3EditGrid<TView extends db3.AnyDB3CrudView>(
    props: DB3CrudEditGridProps<TView>,
): React.ReactElement;
export function DB3EditGrid(props: DB3ReadOnlyGridProps): React.ReactElement;
export function DB3EditGrid(props: DB3CrudEditGridProps<any> | DB3ReadOnlyGridProps) {
    if ("view" in props) return <DB3CrudEditGrid {...props} view={props.view} />;
    return <DB3ReadOnlyGrid {...props} />;
}

function DB3ReadOnlyGrid({ tableSpec, ...props }: DB3ReadOnlyGridProps) {
    const queryState = useDB3EditGridQueryState(tableSpec, props);
    const tableClient = DB3Client.useLegacyTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.PaginatedQuery,
        tableSpec,
        filterModel: {
            items: queryState.filterModel.items.filter(i => i.value !== undefined).map(i => {
                console.assert(i.operator === "equals");
                return { field: i.field, value: i.value, operator: "equals" };
            }),
            quickFilterValues: queryState.filterModel.quickFilterValues,
            tableParams: props.tableParams || {},
        },
        sortModel: queryState.sortModel,
        paginationModel: queryState.paginationModel,
        includeDeleted: queryState.includeDeleted,
    });
    return <DB3EditGridImpl
        {...props}
        tableSpec={tableSpec}
        tableClient={tableClient}
        queryState={queryState}
    />;
}

function DB3CrudEditGrid<TView extends db3.AnyDB3CrudView>({
    view,
    tableSpec,
    ...props
}: DB3CrudEditGridProps<TView>) {
    const queryState = useDB3EditGridQueryState(tableSpec, props);
    const tableClient = DB3Client.useCrudTableRenderContext({
        view,
        tableSpec,
        filterModel: {
            items: queryState.filterModel.items.filter(i => i.value !== undefined).map(i => {
                console.assert(i.operator === "equals");
                return { field: i.field, value: i.value, operator: "equals" };
            }),
            quickFilterValues: queryState.filterModel.quickFilterValues,
            tableParams: props.tableParams || {},
        },
        sortModel: queryState.sortModel,
        paginationModel: queryState.paginationModel,
        includeDeleted: queryState.includeDeleted,
        paginated: true,
    });
    return <DB3EditGridImpl
        {...props}
        disableCreate={props.disableCreate || !view.crud.operations.create}
        tableSpec={tableSpec}
        tableClient={tableClient}
        crud={tableClient.crud}
        queryState={queryState}
    />;
}

type DB3EditGridImplProps<
    TRow extends TAnyModel = TAnyModel,
    TClient extends DB3Client.xTableRenderClient<any, any> = DB3Client.xLegacyTableRenderClient,
> = DB3EditGridBaseProps<TRow, TClient> & {
    tableClient: TClient;
    crud?: DB3Client.CrudViewCommandClient<any, TRow>;
    queryState: DB3EditGridQueryState;
};

function DB3EditGridImpl<
    TRow extends TAnyModel,
    TClient extends DB3Client.xTableRenderClient<any, any>,
>({
    tableSpec,
    tableClient,
    crud,
    queryState,
    ...props
}: DB3EditGridImplProps<TRow, TClient>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = useDashboardContext();
    const readOnly = CoerceToBoolean(props.readOnly, false);
    const [isWaitingForRefresh, setIsWaitingForRefresh] = React.useState<boolean>(false);
    const {
        paginationModel,
        setPaginationModel,
        sortModel,
        setSortModel,
        filterModel,
        setFilterModel,
        publicData,
    } = queryState;

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
    const [isSaving, setIsSaving] = React.useState(false);

    const processRowUpdate = (newRow: GridRowModel, oldRow: GridRowModel) => {
        return new Promise<GridRowModel>((resolve, reject) => {
            const validateResult = tableSpec.args.table.ValidateAndComputeDiff(oldRow, newRow, "update");
            // there are 3 possible paths:
            // 1. validation errors
            // 2. or, changes made
            // 3. or, no changes
            if (!validateResult.success) {
                // display validation error.
                console.log(`processRowUpdate: validation error (validateResult):`);
                console.log(validateResult);
                reject(validateResult.errors);
            }
            else if (validateResult.changeResult.hasChanges) {
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

    const handleYes = async () => {
        const { newRow, oldRow, reject, resolve }: { newRow, oldRow, reject: any, resolve: any } = confirmDialogArgs;
        setIsSaving(true);
        try {
            let updatedRow = newRow;
            if (props.onUpdateRow) updatedRow = await props.onUpdateRow(newRow, oldRow, tableClient);
            else {
                if (!crud) throw new Error("Writable DB3 grids require command-backed CRUD operations.");
                await crud.update(newRow, oldRow);
            }
            resolve(updatedRow);
            if (props.onUpdateRow) {
                await tableClient.refetch();
                dashboardContext.refreshCachedData();
            }
            if (updatedRow !== oldRow) showSnackbar({ children: "update success", severity: 'success' });
        } catch (error) {
            showSnackbar({ children: error instanceof Error ? error.message : "update error", severity: 'error' });
            reject(error);
        } finally {
            setIsSaving(false);
            setConfirmDialogArgs(null);
        }
    };

    const renderDeleteConfirmation = () => {
        if (!deleteRowId) {
            return null;
        }
        const handleYes = () => {
            if (!crud) throw new Error("Writable DB3 grids require command-backed CRUD operations.");
            crud.delete(deleteRowId).then(() => {
                showSnackbar({ children: "deleted successful", severity: 'success' });
                setDeleteRowId(null);
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

        // if (tableSpec.args.table.softDeleteSpec) {

        // }

        return (
            <CMDialog
                open={true}
                onClose={handleClose}
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                title={tableClient.schema.deletePolicy === "softOnly" ? "Deactivate row?" : "Permanently delete row?"}
                actions={<>
                    <CMButton onClick={handleClose}>No</CMButton>
                    <CMButton onClick={handleYes}>Yes</CMButton>
                </>}
            >
                confirm delete
            </CMDialog>
        );
    };

    const renderConfirmDialog = () => {
        if (!confirmDialogArgs) {
            return null;
        }

        // const { oldRow, newRow, validateResult } = confirmDialogArgs;

        return (
            <CMDialog
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
                open={true}
                onClose={isSaving ? undefined : handleNo}
                title={explicitSave ? "Are you sure?" : "Save your changes?"}
                actions={<>
                    <CMButton disabled={isSaving} onClick={handleNo}>No</CMButton>
                    {/* type=submit doesn't seem to work. why? */}
                    <CMButton disabled={isSaving} autoFocus={true} type="submit" onClick={handleYes}>Yes</CMButton>
                </>}
            >
                confirm update...
            </CMDialog>
        );
    };

    const onAddOK = (obj) => {
        if (!crud) throw new Error("Writable DB3 grids require command-backed CRUD operations.");

        crud.create(obj).then((_newRow) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "insert error", severity: 'error' });
            tableClient.refetch();
            throw err;
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
        if (!column.schemaTable.authorizeColumnForView({
            columnName: column.columnName,
            model: null,
            publicData,
        })) {
            continue;
        }

        const c: GridColDef = {
            field: column.columnName,
            headerName: column.headerName,
            editable: !readOnly && column.editable,
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
                    readOnly ? <></> : <GridActionsCellItem
                        icon={<EditIcon className="hoverActionIcon" />}
                        key="edit"
                        label="Edit"
                        onClick={handleEditClick(id)}
                        color="inherit"
                    />,
                    readOnly || tableClient.schema.deletePolicy === "disabled" ? <></> : <GridActionsCellItem
                        icon={<DeleteIcon className="hoverActionIcon" />}
                        key="delete"
                        label="Delete"
                        onClick={handleDeleteClick(id)}
                        color="inherit"
                    />,
                    <React.Fragment key="extra">
                        {props.renderExtraActions && props.renderExtraActions({
                            row: args.row,
                            refetch: tableClient.refetch
                        })}
                    </React.Fragment>,
                ];
            },
        });

    React.useEffect(() => {
        setIsWaitingForRefresh(false);
    }, [tableClient.remainingQueryStatus.dataUpdatedAt]);

    return (<>
        {renderConfirmDialog()}
        {renderDeleteConfirmation()}

        {!!showingNewDialog && <DB3NewObjectDialog
            onCancel={() => { setShowingNewDialog(false); }}
            onOK={onAddOK}
            table={tableSpec}
            tableRenderClient={tableClient}

        />}

        <KeyValueTable data={{
            QueryTimeMS: tableClient.queryResultInfo.executionTimeMillis,
            Updated: <AgeRelativeToNow value={new Date(tableClient.remainingQueryStatus.dataUpdatedAt)} />,// <>   {formatMillisecondsToDHMS((new Date()).valueOf() - dataUpdateAt.valueOf())} ago</>,
            Extras: <CMButtonGroup>
                <CMButton disabled={isWaitingForRefresh} onClick={() => {
                    setIsWaitingForRefresh(true);
                    tableClient.refetch();
                }}>Refresh</CMButton>
                <ClipboardControls client={tableClient} />
            </CMButtonGroup>,
        }} />

        <AdminInspectObject label={"items"} src={tableClient.items} />

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
                    disableCreate: props.disableCreate,
                }
            }}
            getRowHeight={() => 'auto'}

            columns={columns}

            // actual data
            rows={tableClient.items as any}
            rowCount={tableClient.rowCount}
            getRowId={row => row[tableSpec.args.table.clientIdMember]}

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
            isCellEditable={params => props.isCellEditable?.(params.row, params.field) ?? true}
        />
    </>
    );
};


