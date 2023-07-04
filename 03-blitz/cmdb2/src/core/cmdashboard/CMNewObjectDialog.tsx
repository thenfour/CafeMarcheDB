import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    FormControl
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import { formatZodError } from "blitz";
import React from "react";
import { CMNewItemDialogSpec } from "src/core/cmdashboard/CMColumnSpec";

type CMNewObjectDialogProps<TDBModel> = {
    onOK: (obj: TDBModel) => any;
    onCancel: () => any;
    spec: CMNewItemDialogSpec<TDBModel>;
};

export function CMNewObjectDialog<TDBModel>({ onOK, onCancel, spec }: CMNewObjectDialogProps<TDBModel>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [obj, setObj] = React.useState(spec.InitialObj);
    const [validationErrors, setValidationErrors] = React.useState({}); // don't allow null for syntax simplicity

    React.useEffect(() => {
        spec.ZodSchema.safeParseAsync(obj).then((res) => {
            if (!res.error) {
                setValidationErrors({});
                return;
            }
            setValidationErrors(formatZodError(res.error));
        });
    }, [obj]);

    const handleOK = () => {
        onOK(obj);
    };

    return (
        <Dialog
            open={true}
            onClose={onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>{spec.DialogTitle()}</DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    To subscribe to this website, please enter your email address here. We
                    will send updates occasionally.
                </DialogContentText>
                <FormControl>
                    {
                        spec.Fields.map(field => {
                            return field.RenderInputField({
                                key: field.MemberName,
                                validationErrors,
                                value: obj[field.MemberName],
                                onChange: (fieldValue) => {
                                    const newObj = { ...obj };
                                    newObj[field.MemberName] = fieldValue;
                                    if (field.IsForeignObject) {
                                        newObj[field.FKIDMemberName as string] = field.GetIDOfFieldValue!(fieldValue);
                                    }
                                    setObj(newObj);
                                }
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
