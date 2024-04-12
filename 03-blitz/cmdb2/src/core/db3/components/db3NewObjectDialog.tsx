import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    FormControl
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { Suspense } from "react";
import * as db3 from "../db3";
import * as DB3ClientCore from "./DB3ClientCore";
import { TAnyModel } from "shared/utils";
import { gIconMap } from "./IconSelectDialog";
import { useAuthenticatedSession } from "@blitzjs/auth";
import { Markdown } from "src/core/components/RichTextEditor";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";

////////////////////////////////////////////////////////////////
type db3NewObjectDialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => any;
    onCancel: () => any;
    table: DB3ClientCore.xTableClientSpec;
    clientIntention: db3.xTableClientUsageContext;

    caption?: string;
    descriptionSettingName?: string;
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

    return (
        <Suspense>
            <Dialog
                open={true}
                onClose={onCancel}
                scroll="paper"
                className={`ReactiveInputDialog`}
                fullScreen={fullScreen}
            >
                <DialogTitle>
                    {props.caption || <>New {table.args.table.tableName}</>}
                </DialogTitle>
                <DialogContent dividers>

                    {props.descriptionSettingName && <SettingMarkdown settingName={props.descriptionSettingName} />}

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
                                return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                    key: column.columnName,
                                    api,
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

    return (
        <Suspense>
            <Dialog
                open={true}
                onClose={onCancel}
                scroll="paper"
                className={`ReactiveInputDialog`}
                fullScreen={fullScreen}
            >
                <DialogTitle>{props.title || <>Edit {tableRenderClient.tableSpec.args.table.tableName}</>}</DialogTitle>
                <DialogContent dividers>
                    {
                        props.description && <DialogContentText>{props.description}</DialogContentText>
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
                                }));
                            }).map(column => {
                                return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                    key: column.columnName,
                                    api,
                                    row: obj,
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


// ////////////////////////////////////////////////////////////////

export interface DB3EditRowButtonAPI {
    closeDialog: () => void;
};


////////////////////////////////////////////////////////////////
export interface DB3EditRowButtonProps {
    row: TAnyModel;
    tableRenderClient: DB3ClientCore.xTableRenderClient;
    //clientIntention: db3.xTableClientUsageContext;
    onSave: (newRow: TAnyModel, api: DB3EditRowButtonAPI) => void;
};

export const DB3EditRowButton = (props: DB3EditRowButtonProps) => {
    const [editOpen, setEditOpen] = React.useState<boolean>(false);

    return <div className={`DB3EditRowButton`}>
        <Button onClick={() => setEditOpen(true)}>{gIconMap.Edit()}Edit</Button>
        {editOpen && (
            <DB3EditObject2Dialog
                initialValue={props.row}
                //onDelete={props.onDelete}
                //clientIntention={props.clientIntention}
                onCancel={() => setEditOpen(false)}
                onOK={(updatedObj: TAnyModel) => {
                    props.onSave(updatedObj, {
                        closeDialog: () => setEditOpen(false)
                    });
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
        {props.tableRenderClient.clientColumns.map((cc, i) => cc.renderViewer({ key: i, row: props.row, value: props.row[cc.columnName] }))}
    </div>;
};

