import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    FormControl
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import { formatZodError } from "blitz";
import { Role as DBRole } from "db";
import React from "react";
import { Signup as NewUserSchema } from "src/auth/schemas";
//import { RoleColumnSpec } from "src/core/CMDBRole";
import { CMAutocompleteField } from "src/core/cmdashboard/CMAutocompleteField";
import { CMNewItemDialogSpec } from "src/core/cmdashboard/CMColumnSpec";
import { CMTextField } from "src/core/cmdashboard/CMTextField";
import { RoleAutocompleteSpec } from "../CMDBRole";

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
            <DialogTitle>New user</DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    To subscribe to this website, please enter your email address here. We
                    will send updates occasionally.
                </DialogContentText>
                <FormControl>

                    <CMTextField autoFocus={true} label="Name" validationError={validationErrors["name"]} value={obj["name"]} onChange={(e, val) => {
                        setObj({ ...obj, name: val });
                    }}
                    ></CMTextField>
                    <CMTextField autoFocus={false} label="Email" validationError={validationErrors["email"]} value={obj["email"]} onChange={(e, val) => {
                        setObj({ ...obj, email: val });
                    }}
                    ></CMTextField>
                    <CMAutocompleteField<DBRole> columnSpec={RoleAutocompleteSpec} valueObj={obj.role} onChange={(role) => {
                        setObj({ ...obj, role, roleId: (role?.id || null) });
                    }}></CMAutocompleteField>

                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={handleOK}>OK</Button>
            </DialogActions>
        </Dialog>
    );
};
