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
import { ConfirmationDialog } from "src/core/components/CMCoreComponents";

////////////////////////////////////////////////////////////////
type db3NewObjectDialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => any;
    onCancel: () => any;
    table: DB3ClientCore.xTableClientSpec;
    clientIntention: db3.xTableClientUsageContext;
};

export function DB3NewObjectDialog({ onOK, onCancel, table, clientIntention }: db3NewObjectDialogProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(table.args.table.createNew(clientIntention));
    const [oldObj, setOldObj] = React.useState(table.args.table.createNew(clientIntention)); // needed for tracking changes
    const [validationResult, setValidationResult] = React.useState<db3.ValidateAndComputeDiffResult>(db3.EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity

    const tableClient = DB3ClientCore.useTableRenderContext({
        requestedCaps: DB3ClientCore.xTableClientCaps.Mutation,
        tableSpec: table,
        clientIntention,
    });

    // validate on change
    React.useEffect(() => {
        const vr = tableClient.tableSpec.args.table.ValidateAndComputeDiff(oldObj, obj, "new");
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
                fullScreen={fullScreen}
            >
                <DialogTitle>new {table.args.table.tableName}</DialogTitle>
                <DialogContent dividers>
                    <DialogContentText>
                        To subscribe to this website, please enter your email address here. We
                        will send updates occasionally.
                    </DialogContentText>
                    <FormControl>

                        {
                            tableClient.clientColumns.map(column => {
                                return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                    key: column.columnName,
                                    api,
                                    row: obj,
                                    value: obj[column.columnName],
                                    validationResult,
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
type DB3EditObjectDialogProps = {
    onOK: (obj: TAnyModel, tableClient: DB3ClientCore.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableClient: DB3ClientCore.xTableRenderClient) => void;
    table: DB3ClientCore.xTableClientSpec;
    clientIntention: db3.xTableClientUsageContext;
    initialValue: TAnyModel;
};

export function DB3EditObjectDialog({ onOK, onCancel, table, clientIntention, initialValue, onDelete }: DB3EditObjectDialogProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(initialValue);
    const [oldObj, setOldObj] = React.useState(initialValue); // needed for tracking changes during validation
    const [validationResult, setValidationResult] = React.useState<db3.ValidateAndComputeDiffResult>(db3.EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity

    const [showingDeleteConfirmation, setShowingDeleteConfirmation] = React.useState<boolean>(false);

    const tableClient = DB3ClientCore.useTableRenderContext({
        requestedCaps: DB3ClientCore.xTableClientCaps.Mutation,
        tableSpec: table,
        clientIntention,
    });

    // validate on change
    React.useEffect(() => {
        const vr = tableClient.tableSpec.args.table.ValidateAndComputeDiff(oldObj, obj, "new");
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

    const handleDelete = () => {
        onDelete!(tableClient);
    }

    return (
        <Suspense>
            <Dialog
                open={true}
                onClose={onCancel}
                scroll="paper"
                fullScreen={fullScreen}
            >
                <DialogTitle> new {table.args.table.tableName}</DialogTitle>
                <DialogContent dividers>
                    <DialogContentText>
                        To subscribe to this website, please enter your email address here. We
                        will send updates occasionally.
                    </DialogContentText>
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
                            tableClient.clientColumns.map(column => {
                                return column.renderForNewDialog && <React.Fragment key={column.columnName}>{column.renderForNewDialog!({
                                    key: column.columnName,
                                    api,
                                    row: obj,
                                    value: obj[column.columnName],
                                    validationResult,
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


