import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import Chip from '@mui/material/Chip';
import { Role as DBRole, User as DBUser } from "db";
import CreateRoleMutation from "src/auth/mutations/createRole";
import SoftDeleteUserMutation from "src/auth/mutations/deleteUser";
import insertUserMutation from 'src/auth/mutations/insertUser';
import NewUserMutationSpec from "src/auth/mutations/newUser";
import updateUserFromGrid from "src/auth/mutations/updateUserFromGrid";
import getAllRoles from 'src/auth/queries/getAllRoles';
import getUsers from "src/auth/queries/getUsers";
import { InsertUserSchema, Signup as NewUserSchema, UpdateUserFromGrid as UpdateUserFromGridSchema, UserEmailSchema, UserNameSchema } from "src/auth/schemas";
import { CMEditGridColumnType, CMEditGridSpec, CMNewItemDialogFieldSpec, CMNewItemDialogSpec, CMTableSpec, CreateEditGridColumnSpec, PKIDField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { RenderRole, RoleAutocompleteSpec, RoleGridEditCellSpec } from './CMDBRole';
import { CMAutocompleteField } from './cmdashboard/CMAutocompleteField';
import { CMTextField } from './cmdashboard/CMTextField';
import { ForeignSingleField, InsertFromStringParams, RenderAsChipParams } from './cmdashboard/dbcomponents2/CMForeignSingleField';

export class UserRoleField extends ForeignSingleField<DBUser, DBRole> {
    constructor() {
        super({
            getAllOptionsQuery: getAllRoles,
            allowNull: true,
            cellWidth: 220,
            fkidMember: "roleId",
            member: "role",
            foreignPk: "id",
            label: "Role",
            allowInsertFromString: true,
            insertFromStringMutation: CreateRoleMutation,
            insertFromStringSchema: null,
            insertFromString: async (params: InsertFromStringParams<DBRole>) => {
                return await params.mutation({ name: params.input, description: "" });
            },
            getForeignQuickFilterWhereClause: (query: string) => {
                return { name: { contains: query } };
            },
            doesItemExactlyMatchText: (item: DBRole, filterText: string) => {
                return item.name.trim().toLowerCase() === filterText.trim().toLowerCase();
            },
            renderAsChip: (args: RenderAsChipParams<DBRole>) => {
                if (!args.value) {
                    return <>--</>;
                }
                return <Chip
                    size="small"
                    label={`${args.value.name}`}
                    onDelete={args.onDelete}
                />;
            },
            renderAsListItem: (props, value, selected) => {
                return <li {...props}>
                    {selected && <DoneIcon />}
                    {value.name}
                    {selected && <CloseIcon />}
                </li>
            },
        });
    }

    getQuickFilterWhereClause = (query: string) => {
        return { role: { name: { contains: query } } };
    };
};

export const UserTableSpec = new CMTableSpec<DBUser>({
    devName: "user",
    CreateMutation: insertUserMutation,
    CreateSchema: InsertUserSchema,
    GetPaginatedItemsQuery: getUsers,
    UpdateMutation: updateUserFromGrid,
    UpdateSchema: UpdateUserFromGridSchema,
    DeleteMutation: SoftDeleteUserMutation,
    GetNameOfRow: (row: DBUser) => { return row.name; },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Name", member: "name", zodSchema: UserNameSchema }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Email", member: "email", zodSchema: UserEmailSchema }),
        new UserRoleField(),
    ],
});





// export const NewUserDialogSpec: CMNewItemDialogSpec<DBUser> = {
//     InitialObj: {
//         name: "",
//         email: "",
//         password: "1234567890!@#$%^&aoeuAOEU",
//     },
//     ZodSchema: NewUserSchema,

//     Fields: [
//         {
//             MemberName: "name",
//             IsForeignObject: false,
//             FKIDMemberName: undefined,
//             GetIDOfFieldValue: undefined,
//             RenderInputField: ({ key, validationErrors, onChange, value }) => {
//                 return (<CMTextField
//                     key={key}
//                     autoFocus={true}
//                     label="Name"
//                     validationError={validationErrors["name"]}
//                     value={value}
//                     onChange={(e, val) => {
//                         console.log(`changed name to ${val}`);
//                         return onChange(val);
//                     }}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<string>,
//         {
//             MemberName: "email",
//             IsForeignObject: false,
//             FKIDMemberName: undefined,
//             GetIDOfFieldValue: undefined,
//             RenderInputField: ({ key, validationErrors, onChange, value }) => {
//                 return (<CMTextField
//                     key={key}
//                     autoFocus={true}
//                     label="Email"
//                     validationError={validationErrors["email"]}
//                     value={value}
//                     onChange={(e, val) => onChange(val)}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<string>,
//         {
//             MemberName: "role",
//             IsForeignObject: true,
//             FKIDMemberName: "id",
//             GetIDOfFieldValue: (value) => (value?.id || null),
//             RenderInputField: ({ key, validationErrors, onChange, value }) => {
//                 return (<CMAutocompleteField<DBRole>
//                     key={key}
//                     columnSpec={RoleAutocompleteSpec}
//                     valueObj={value}
//                     onChange={(role) => onChange}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<DBRole>,
//     ],

//     DialogTitle: () => `New user`,
// };

// export const UserEditGridSpec: CMEditGridSpec<DBUser> = {
//     PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"

//     CreateMutation: NewUserMutationSpec,
//     GetPaginatedItemsQuery: getUsers,
//     UpdateMutation: updateUserFromGrid, // support editing of grid columns
//     DeleteMutation: SoftDeleteUserMutation, // by pk alone

//     PageSizeOptions: [3, 25, 100],
//     PageSizeDefault: 25,

//     CreateItemButtonText: () => `New user`,
//     CreateSuccessSnackbar: (item: DBUser) => `User ${item.name} added`,
//     CreateErrorSnackbar: (err: any) => `Server error while adding user`,
//     UpdateItemSuccessSnackbar: (updatedItem: DBUser) => `User ${updatedItem.name} updated.`,
//     UpdateItemErrorSnackbar: (err: any) => `Server error while updating user`,
//     DeleteItemSuccessSnackbar: (updatedItem: DBUser) => `deleted user success`,
//     DeleteItemErrorSnackbar: (err: any) => `deleted user error`,
//     NoChangesMadeSnackbar: (item: DBUser) => "No changes were made",
//     DeleteConfirmationMessage: (item: DBUser) => `Pressing 'Yes' will delete '${item.name}'`,
//     UpdateConfirmationMessage: (oldItem: DBUser, newItem: DBUser, mutation: any[]) => `Pressing 'Yes' will update user ${oldItem.name}`,
//     DefaultOrderBy: { id: "asc" },

//     ComputeDiff: (oldItem: DBUser, newItem: DBUser) => { // return an array of changes made. must be falsy if equal
//         if (newItem.name !== oldItem.name) {
//             return true;
//         }
//         if (newItem.email !== oldItem.email) {
//             return true;
//         }
//         if (newItem.roleId !== oldItem.roleId) {
//             return true;
//         }
//         return false;
//     },
//     GetQuickFilterWhereClauseExpression: (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
//         return [
//             { name: { contains: query } },
//             { email: { contains: query } },
//         ];
//     },

//     NewItemDialogSpec: NewUserDialogSpec,

//     Columns: [
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.PK, MemberName: "id", Editable: true, }),
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "name", Editable: true, }),
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "email", Editable: true, }),
//         CreateEditGridColumnSpec({
//             Behavior: CMEditGridColumnType.ForeignObject,
//             MemberName: "role",
//             FKIDMemberName: "roleId",
//             FKEditCellSpec: RoleGridEditCellSpec,
//             FKRenderViewCell: RenderRole,
//             Editable: true,
//         }),
//     ],
// };
