import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    FormControl
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import React from "react";
import * as db3 from "../db3";
import * as DB3ClientCore from "./DB3ClientCore";
import { TAnyModel } from "shared/utils";

type db3NewObjectDialogProps = {
    onOK: (obj: TAnyModel) => any;
    onCancel: () => any;
    table: DB3ClientCore.xTableClientSpec;
};

export function DB3NewObjectDialog({ onOK, onCancel, table }: db3NewObjectDialogProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(table.args.table.defaultObject);
    const [oldObj, setOldObj] = React.useState(table.args.table.defaultObject); // needed for tracking changes
    const [validationResult, setValidationResult] = React.useState<db3.ValidateAndComputeDiffResult>(db3.EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity

    const tableClient = DB3ClientCore.useTableRenderContext({
        requestedCaps: DB3ClientCore.xTableClientCaps.Mutation,
        tableSpec: table,
    });

    // validate on change
    React.useEffect(() => {
        setValidationResult(tableClient.tableSpec.args.table.ValidateAndComputeDiff(oldObj, obj));
        setOldObj(obj);
    }, [obj]);

    const handleOK = () => {
        // check validation and disallow
        if (!validationResult.success) {
            return;
        }
        onOK(obj);
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
                                obj,
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
    );
};
