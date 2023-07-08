import {
    Person as UserIcon
} from '@mui/icons-material';
import {
    ListItemIcon, ListItemText
} from "@mui/material";
import Chip from '@mui/material/Chip';
import { User as DBUser, Role as DBRole } from "db";
import { CMNewItemDialogSpec, CMNewItemDialogFieldSpec, CMEditGridSpec, CreateEditGridColumnSpec, CMEditGridColumnType } from "src/core/cmdashboard/CMColumnSpec";
import { Signup as NewUserSchema } from "src/auth/schemas";
import { CMTextField } from './cmdashboard/CMTextField';
import { CMAutocompleteField } from './cmdashboard/CMAutocompleteField';
import { RenderRole, RoleAutocompleteSpec, RoleGridEditCellSpec } from './CMDBRole';
import getUsers from "src/auth/queries/getUsers";
import updateUserFromGrid from "src/auth/mutations/updateUserFromGrid";
import SoftDeleteUserMutation from "src/auth/mutations/deleteUser";
import NewUserMutationSpec from "src/auth/mutations/signup";


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

export const UserEditGridSpec: CMEditGridSpec<DBUser> = {
    PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"

    CreateMutation: NewUserMutationSpec,
    GetPaginatedItemsQuery: getUsers,
    UpdateMutation: updateUserFromGrid, // support editing of grid columns
    DeleteMutation: SoftDeleteUserMutation, // by pk alone

    PageSizeOptions: [3, 25, 100],
    PageSizeDefault: 25,

    CreateItemButtonText: () => `New user`,
    CreateSuccessSnackbar: (item: DBUser) => `User ${item.name} added`,
    CreateErrorSnackbar: (err: any) => `Server error while adding user`,
    UpdateItemSuccessSnackbar: (updatedItem: DBUser) => `User ${updatedItem.name} updated.`,
    UpdateItemErrorSnackbar: (err: any) => `Server error while updating user`,
    DeleteItemSuccessSnackbar: (updatedItem: DBUser) => `deleted user success`,
    DeleteItemErrorSnackbar: (err: any) => `deleted user error`,
    NoChangesMadeSnackbar: (item: DBUser) => "No changes were made",
    DeleteConfirmationMessage: (item: DBUser) => `Pressing 'Yes' will delete '${item.name}'`,
    UpdateConfirmationMessage: (oldItem: DBUser, newItem: DBUser, mutation: any[]) => `Pressing 'Yes' will update user ${oldItem.name}`,
    DefaultOrderBy: { id: "asc" },

    ComputeDiff: (oldItem: DBUser, newItem: DBUser) => { // return an array of changes made. must be falsy if equal
        if (newItem.name !== oldItem.name) {
            return true;
        }
        if (newItem.email !== oldItem.email) {
            return true;
        }
        if (newItem.roleId !== oldItem.roleId) {
            return true;
        }
        return false;
    },
    GetQuickFilterWhereClauseExpression: (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
        return [
            { name: { contains: query } },
            { email: { contains: query } },
        ];
    },

    NewItemDialogSpec: NewUserDialogSpec,

    Columns: [
        CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.PK, MemberName: "id", Editable: true, }),
        CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "name", Editable: true, }),
        CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "email", Editable: true, }),
        CreateEditGridColumnSpec({
            Behavior: CMEditGridColumnType.ForeignObject,
            MemberName: "role",
            FKIDMemberName: "roleId",
            FKEditCellSpec: RoleGridEditCellSpec,
            FKRenderViewCell: RenderRole,
            Editable: true,
        }),
    ],
};
