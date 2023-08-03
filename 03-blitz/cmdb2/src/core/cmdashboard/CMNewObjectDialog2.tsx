import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    FormControl
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import { formatZodError } from "blitz";
import React from "react";
import { CMTableSpec, EmptyValidateAndComputeDiffResult, NewDialogAPI, NewDialogAPIFieldValue, ValidateAndComputeDiffResult } from "src/core/cmdashboard/CMColumnSpec";

type CMNewObject2DialogProps<TDBModel> = {
    onOK: (obj: TDBModel) => any;
    onCancel: () => any;
    spec: CMTableSpec<TDBModel>;
};

export function CMNewObjectDialog2<TDBModel>({ onOK, onCancel, spec }: CMNewObject2DialogProps<TDBModel>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(spec.initialObj);
    const [oldObj, setOldObj] = React.useState(spec.initialObj); // needed for tracking changes
    const [validationResult, setValidationResult] = React.useState<ValidateAndComputeDiffResult>(EmptyValidateAndComputeDiffResult); // don't allow null for syntax simplicity

    // validate on change
    React.useEffect(() => {
        setValidationResult(spec.ValidateAndComputeDiff(oldObj, obj));
        setOldObj(obj);
    }, [obj]);

    const handleOK = () => {
        onOK(obj);
    };

    const api: NewDialogAPI = {
        setFieldValues: (fieldValues: { [key: string]: any }) => {
            // so i think the reason MUI datagrid's API makes this a promise, is that when you setState(), it doesn't update
            // local variables; it's asynchronous. either we go that model which is more complex, or this where you can set multiple fields at once.
            // drawback is callers don't know when the change has been applied so can't do anything afterwards.
            const newObj = { ...obj, ...fieldValues };
            setObj(newObj);
            console.log(`New object dlg set new object to:`);
            console.log(newObj);
        },
        // setFieldValues: (fieldValues: NewDialogAPIFieldValue[]) => {
        //     const newObj = { ...obj, }
        // },

        // setFieldValues: (member: string, value: any) => {
        //     // so i think the reason MUI datagrid's API makes this a promise, is that when you setState(), it doesn't update
        //     // local variables; it's asynchronous.
        //     const newObj = { ...obj };
        //     newObj[member] = value;
        //     setObj(newObj);
        // },
    };

    return (
        <Dialog
            open={true}
            onClose={onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>{spec.NewItemDialogTitle()}</DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    To subscribe to this website, please enter your email address here. We
                    will send updates occasionally.
                </DialogContentText>
                <FormControl>
                    {
                        spec.fields.map(field => {
                            if (!field.renderForNewDialog) {
                                return null;
                            }
                            return field.renderForNewDialog!({
                                key: field.member,
                                validationResult,
                                obj,
                                value: obj[field.member],
                                api,
                            });

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
