import {
    Person as UserIcon
} from '@mui/icons-material';
import {
    ListItemIcon, ListItemText
} from "@mui/material";
import Chip from '@mui/material/Chip';
import { User as DBUser, Role as DBRole } from "db";
import { CMNewItemDialogSpec, CMNewItemDialogFieldSpec } from "src/core/cmdashboard/CMColumnSpec";
import { Signup as NewUserSchema } from "src/auth/schemas";
import { CMTextField } from './cmdashboard/CMTextField';
import { CMAutocompleteField } from './cmdashboard/CMAutocompleteField';
import { RoleAutocompleteSpec } from './CMDBRole';


export const NewUserDialogSpec: CMNewItemDialogSpec<DBUser> = {
    InitialObj: {
        name: "",
        email: "",
        password: "1234567890!@#$%^&aoeuAOEU",
    },
    ZodSchema: NewUserSchema,

    Fields: [
        {
            MemberName: "name",
            IsForeignObject: false,
            FKIDMemberName: undefined,
            GetIDOfFieldValue: undefined,
            RenderInputField: ({ key, validationErrors, onChange, value }) => {
                return (<CMTextField
                    key={key}
                    autoFocus={true}
                    label="Name"
                    validationError={validationErrors["name"]}
                    value={value}
                    onChange={(e, val) => {
                        console.log(`changed name to ${val}`);
                        return onChange(val);
                    }}
                />);
            },
        } as CMNewItemDialogFieldSpec<string>,
        {
            MemberName: "email",
            IsForeignObject: false,
            FKIDMemberName: undefined,
            GetIDOfFieldValue: undefined,
            RenderInputField: ({ key, validationErrors, onChange, value }) => {
                return (<CMTextField
                    key={key}
                    autoFocus={true}
                    label="Email"
                    validationError={validationErrors["email"]}
                    value={value}
                    onChange={(e, val) => onChange(val)}
                />);
            },
        } as CMNewItemDialogFieldSpec<string>,
        {
            MemberName: "role",
            IsForeignObject: true,
            FKIDMemberName: "id",
            GetIDOfFieldValue: (value) => (value?.id || null),
            RenderInputField: ({ key, validationErrors, onChange, value }) => {
                return (<CMAutocompleteField<DBRole>
                    key={key}
                    columnSpec={RoleAutocompleteSpec}
                    valueObj={value}
                    onChange={(role) => onChange}
                />);
            },
        } as CMNewItemDialogFieldSpec<DBRole>,
    ],

    DialogTitle: () => `New user`,
};
