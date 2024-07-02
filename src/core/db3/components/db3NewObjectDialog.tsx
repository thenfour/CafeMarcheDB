import { useAuthenticatedSession } from "@blitzjs/auth";
import {
    Button, Dialog, DialogActions, DialogContent,
    DialogTitle,
    FormControl
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { Suspense } from "react";
import { SettingKey } from "shared/utils";
import { CMDialogContentText, CMSmallButton } from "src/core/components/CMCoreComponents2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "../db3";
import * as DB3ClientCore from "./DB3ClientCore";
import { TAnyModel } from "../shared/apiTypes";
import { AdminInspectObject } from "src/core/components/CMCoreComponents";
import { gIconMap } from "./IconMap";

////////////////////////////////////////////////////////////////
type db3NewObjectDialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => any;
    onCancel: () => any;
    table: DB3ClientCore.xTableClientSpec;
    clientIntention: db3.xTableClientUsageContext;

    caption?: string;
    descriptionSettingName?: SettingKey;
};

export function DB3NewObjectDialog({ onOK, onCancel, table, clientIntention, ...props }: db3NewObjectDialogProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(table.args.table.createNew(clientIntention));
    const [oldObj, setOldObj] = React.useState(table.args.table.createNew(clientIntention)); // needed for tracking changes
    const [validationResult, setValidationResult] = React.useState<db3.ValidateAndComputeDiffResult>(db3.EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity
    const publicData = useAuthenticatedSession();

    const tableClient = DB3ClientCore.useTableRenderContext({
        requestedCaps: DB3ClientCore.xTableClientCaps.Mutation,
        tableSpec: table,
        clientIntention,
    });

    // validate on change
    React.useEffect(() => {
        const vr = tableClient.tableSpec.args.table.ValidateAndComputeDiff(oldObj, obj, "new", clientIntention);
        setValidationResult(vr);
        setOldObj(obj);
    }, [obj]);

    const handleOK = () => {
        // check validation and disallow
        if (!validationResult.success) {
            console.log(`DB3NewObjectDialog handleOK validation error`);
            console.log(validationResult);
            return;
        }
        onOK(obj, tableClient);
    };

    const api: DB3ClientCore.NewDialogAPI = {
        setFieldValues: (fieldValues: { [key: string]: any }) => {
            // so i think the reason MUI datagrid's API makes this a promise, is that when you setState(), it doesn't update
            // local variables; it's asynchronous. either we go that model which is more complex, or this where you can set multiple fields at once.
            // drawback is callers don't know when the change has been applied so can't do anything afterwards.
            const newObj = { ...obj, ...fieldValues };
            setObj(newObj);
        },
    };

    let encounteredAutofocusable = false;

    return (
        <Suspense>
            <Dialog
                open={true}
                onClose={onCancel}
                scroll="paper"
                className={`ReactiveInputDialog ${fullScreen ? "smallScreen" : "bigScreen"}`}
                fullScreen={fullScreen}
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
            >
                <DialogTitle>
                    {props.caption || <>New {table.args.table.tableName}</>}
                </DialogTitle>
                <DialogContent dividers>

                    {props.descriptionSettingName && <SettingMarkdown setting={props.descriptionSettingName} />}

                    <FormControl>

                        {
                            tableClient.clientColumns.filter(c => {
                                if (!c.visible) return false;
                                return tableClient.schema.authorizeColumnForInsert({
                                    clientIntention: tableClient.args.clientIntention,
                                    model: obj,
                                    columnName: c.columnName,
                                    publicData,
                                });
                            }).map(column => {
                                let autoFocus = false;
                                if (!encounteredAutofocusable && column.isAutoFocusable) {
                                    encounteredAutofocusable = true;
                                    autoFocus = true;
                                }
                                return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                    key: column.columnName,
                                    api,
                                    autoFocus,
                                    row: obj,
                                    value: obj[column.columnName],
                                    validationResult,
                                    clientIntention,
                                })}</React.Fragment>;
                            })
                        }

                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleOK}>OK</Button>
                </DialogActions>
            </Dialog>
        </Suspense>
    );
};




////////////////////////////////////////////////////////////////
// similar to DB3EditObjectDialog but uses external table render client.
type DB3EditObject2DialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableClient: DB3ClientCore.xTableRenderClient) => void;
    tableRenderClient: DB3ClientCore.xTableRenderClient;
    initialValue: TAnyModel;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

export function DB3EditObject2Dialog({ onOK, onCancel, tableRenderClient, initialValue, onDelete, ...props }: DB3EditObject2DialogProps) {
    const theme = useTheme();
    const publicData = useAuthenticatedSession();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(initialValue);
    const [oldObj, setOldObj] = React.useState(initialValue); // needed for tracking changes during validation
    const [validationResult, setValidationResult] = React.useState<db3.ValidateAndComputeDiffResult>(db3.EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity

    const [showingDeleteConfirmation, setShowingDeleteConfirmation] = React.useState<boolean>(false);

    // validate on change
    React.useEffect(() => {
        const vr = tableRenderClient.tableSpec.args.table.ValidateAndComputeDiff(oldObj, obj, "update", tableRenderClient.args.clientIntention);
        setValidationResult(vr);
        setOldObj(obj);
    }, [obj]);

    const handleOK = () => {
        // check validation and disallow
        if (!validationResult.success) {
            console.log(`DB3NewObjectDialog handleOK validation error`);
            console.log(validationResult);
            return;
        }
        onOK(obj, tableRenderClient);
    };

    const api: DB3ClientCore.NewDialogAPI = {
        setFieldValues: (fieldValues: { [key: string]: any }) => {
            // so i think the reason MUI datagrid's API makes this a promise, is that when you setState(), it doesn't update
            // local variables; it's asynchronous. either we go that model which is more complex, or this where you can set multiple fields at once.
            // drawback is callers don't know when the change has been applied so can't do anything afterwards.
            const newObj = { ...obj, ...fieldValues };
            setObj(newObj);
        },
    };

    const handleDelete = () => {
        onDelete!(tableRenderClient);
    }

    let encounteredAutofocusable = false;

    return (
        <Suspense>
            <Dialog
                open={true}
                onClose={onCancel}
                scroll="paper"
                className={`ReactiveInputDialog ${fullScreen ? "smallScreen" : "bigScreen"}`}
                fullScreen={fullScreen}
                disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
            >
                <DialogTitle>
                    {props.title || <>Edit {tableRenderClient.tableSpec.args.table.tableName}</>}
                    <AdminInspectObject src={initialValue} label="initial value" />
                </DialogTitle>
                <DialogContent dividers>
                    {
                        props.description && <CMDialogContentText>{props.description}</CMDialogContentText>
                    }
                    {
                        onDelete && (<div className="deleteConfirmationControlContainer">
                            <Button onClick={() => setShowingDeleteConfirmation(true)}>{gIconMap.Delete()}Delete</Button>
                            {showingDeleteConfirmation && (<div className="deleteConfirmationControl">Are you sure you want to delete this item?
                                <Button onClick={() => setShowingDeleteConfirmation(false)}>nope, cancel</Button>
                                <Button onClick={() => { handleDelete(); setShowingDeleteConfirmation(false) }}>yes</Button>
                            </div>)}
                        </div>)
                    }
                    <FormControl>

                        {
                            tableRenderClient.clientColumns.filter(c => {
                                if (!c.visible) return false;
                                return (c.schemaTable.authorizeColumnForEdit({
                                    clientIntention: tableRenderClient.args.clientIntention,
                                    columnName: c.columnName,
                                    model: obj,
                                    publicData,
                                    fallbackOwnerId: null,// assume model has this.
                                }));
                            }).map(column => {
                                let autoFocus = false;
                                if (!encounteredAutofocusable && column.isAutoFocusable) {
                                    encounteredAutofocusable = true;
                                    autoFocus = true;
                                }
                                return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                    key: column.columnName,
                                    api,
                                    row: obj,
                                    autoFocus,
                                    value: obj[column.columnName],
                                    validationResult,
                                    clientIntention: tableRenderClient.args.clientIntention,
                                })}</React.Fragment>;
                            })
                        }

                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleOK}>OK</Button>
                </DialogActions>
            </Dialog>
        </Suspense >
    );
};






////////////////////////////////////////////////////////////////
type DB3EditObjectDialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableClient: DB3ClientCore.xTableRenderClient) => void;
    table: DB3ClientCore.xTableClientSpec;
    clientIntention: db3.xTableClientUsageContext;
    initialValue: TAnyModel;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

export function DB3EditObjectDialog({ onOK, onCancel, table, clientIntention, initialValue, onDelete, ...props }: DB3EditObjectDialogProps) {
    const tableClient = DB3ClientCore.useTableRenderContext({
        requestedCaps: DB3ClientCore.xTableClientCaps.Mutation,
        tableSpec: table,
        clientIntention,
    });

    return <DB3EditObject2Dialog
        initialValue={initialValue}
        onCancel={onCancel}
        onOK={onOK}
        onDelete={onDelete}
        tableRenderClient={tableClient}
        title={props.title}
        description={props.description}
    />
};


//////////////////////////////////////////////////////////////////
export interface DB3EditRowButtonAPI {
    closeDialog: () => void;
};

export interface DB3EditRowButtonProps {
    row: TAnyModel;
    tableRenderClient: DB3ClientCore.xTableRenderClient;
    onSave: (newRow: TAnyModel, api: DB3EditRowButtonAPI) => void;
    label?: React.ReactNode;
    smallButton?: boolean;
    onDelete?: (api: DB3EditRowButtonAPI) => void;
};

// like on the user profile, a "Edit" button which pops up a dialog to edit fields
export const DB3EditRowButton = (props: DB3EditRowButtonProps) => {
    const [editOpen, setEditOpen] = React.useState<boolean>(false);
    const publicData = useAuthenticatedSession();

    const deleteAuthorized = props.tableRenderClient.args.tableSpec.args.table.authorizeRowForDeletePreferSoft({
        clientIntention: props.tableRenderClient.args.clientIntention,
        publicData,
        model: props.row,
    });

    const buttonChildren = props.label || <>{gIconMap.Edit()}Edit</>;

    const api: DB3EditRowButtonAPI = {
        closeDialog: () => setEditOpen(false)
    };


    const onDelete = !!props.onDelete && deleteAuthorized ? () => {
        props.onDelete!(api);
    } : undefined;

    return <div className={`DB3EditRowButton`}>
        {!!props.smallButton ? (
            <CMSmallButton onClick={() => setEditOpen(true)}>{buttonChildren}</CMSmallButton>
        ) : (
            <Button onClick={() => setEditOpen(true)}>{buttonChildren}</Button>
        )}
        {editOpen && (
            <DB3EditObject2Dialog
                initialValue={props.row}
                onDelete={onDelete}
                //clientIntention={props.clientIntention}
                onCancel={() => setEditOpen(false)}
                onOK={(updatedObj: TAnyModel) => {
                    props.onSave(updatedObj, api);
                }}
                tableRenderClient={props.tableRenderClient}
            />

        )}
    </div>;

};




////////////////////////////////////////////////////////////////
export interface DB3RowViewerProps {
    tableRenderClient: DB3ClientCore.xTableRenderClient;
    row: TAnyModel;
};

export const DB3RowViewer = (props: DB3RowViewerProps) => {
    return <div className="DB3RowViewer">
        {props.tableRenderClient.clientColumns.map((cc, i) => <React.Fragment key={i}>{cc.renderViewer({ key: i, row: props.row, value: props.row[cc.columnName] })}</React.Fragment>)}
    </div>;
};

