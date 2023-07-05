import { Permission as DBPermission } from "db";
import { CMNewItemDialogSpec, CMNewItemDialogFieldSpec, CMEditGridSpec, CreateEditGridColumnSpec, CMEditGridColumnType } from "src/core/cmdashboard/CMColumnSpec";
import { CreatePermission as CreatePermissionSchema } from "src/auth/schemas";
import { CMTextField } from './cmdashboard/CMTextField';
import getPaginatedPermissions from "src/auth/queries/getPaginatedPermissions";
import updatePermission from "src/auth/mutations/updatePermission";
import deletePermission from "src/auth/mutations/deletePermission";
import insertPermission from "src/auth/mutations/insertPermission";
//import { CMAutocompleteField } from './cmdashboard/CMAutocompleteField';
//import { RenderRole, RoleAutocompleteSpec, RoleGridEditCellSpec } from './CMDBRole';
// import getUsers from "src/users/queries/getUsers";
// import updateUserFromGrid from "src/users/mutations/updateUserFromGrid";
// import SoftDeleteUserMutation from "src/auth/mutations/deleteUser";
// import NewUserMutationSpec from "src/auth/mutations/signup";


export const NewPermissionDialogSpec: CMNewItemDialogSpec<DBPermission> = {
    InitialObj: {
        name: "",
        email: "",
        password: "1234567890!@#$%^&aoeuAOEU",
    },
    ZodSchema: CreatePermissionSchema,

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
                        return onChange(val);
                    }}
                />);
            },
        } as CMNewItemDialogFieldSpec<string>,
        {
            MemberName: "description",
            IsForeignObject: false,
            FKIDMemberName: undefined,
            GetIDOfFieldValue: undefined,
            RenderInputField: ({ key, validationErrors, onChange, value }) => {
                return (<CMTextField
                    key={key}
                    autoFocus={true}
                    label="description"
                    validationError={validationErrors["description"]}
                    value={value}
                    onChange={(e, val) => onChange(val)}
                />);
            },
        } as CMNewItemDialogFieldSpec<string>,
    ],

    DialogTitle: () => `New permission`,
};

export const PermissionEditGridSpec: CMEditGridSpec<DBPermission> = {
    PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"

    CreateMutation: insertPermission,
    GetPaginatedItemsQuery: getPaginatedPermissions,
    UpdateMutation: updatePermission, // support editing of grid columns
    DeleteMutation: deletePermission, // by pk alone

    PageSizeOptions: [3, 25, 100],
    PageSizeDefault: 25,

    CreateSuccessSnackbar: (item: DBPermission) => `permission ${item.name} added`,
    CreateErrorSnackbar: (err: any) => `Server error while adding permission`,
    UpdateItemSuccessSnackbar: (updatedItem: DBPermission) => `permission ${updatedItem.name} updated.`,
    UpdateItemErrorSnackbar: (err: any) => `Server error while updating permission`,
    NoChangesMadeSnackbar: (item: DBPermission) => "No changes were made",
    DeleteConfirmationMessage: (item: DBPermission) => `Pressing 'Yes' will delete '${item.name}'`,
    UpdateConfirmationMessage: (oldItem: DBPermission, newItem: DBPermission, mutation: any[]) => `Pressing 'Yes' will update permission ${oldItem.name}`,
    DefaultOrderBy: { id: "asc" },

    ComputeDiff: (oldItem: DBPermission, newItem: DBPermission) => { // return an array of changes made. must be falsy if equal
        if (newItem.name !== oldItem.name) {
            return true;
        }
        if (newItem.description !== oldItem.description) {
            return true;
        }
        return false;
    },
    GetQuickFilterWhereClauseExpression: (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
        return [
            { name: { contains: query } },
            { description: { contains: query } },
        ];
    },

    NewItemDialogSpec: NewPermissionDialogSpec,

    Columns: [
        CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.PK, MemberName: "id", Editable: true, }),
        CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "name", Editable: true, }),
        CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "description", Editable: true, }),
    ],
};
