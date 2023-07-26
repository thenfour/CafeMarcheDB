import { Event as DBEvent } from "db";
import { CMNewItemDialogSpec, CMNewItemDialogFieldSpec, CMEditGridSpec, CreateEditGridColumnSpec, CMEditGridColumnType } from "src/core/cmdashboard/CMColumnSpec";
//import { Signup as NewUserSchema } from "src/auth/schemas";
import { CMTextField } from './cmdashboard/CMTextField';
import { CMAutocompleteField } from './cmdashboard/CMAutocompleteField';
import { RenderRole, RoleAutocompleteSpec, RoleGridEditCellSpec } from './CMDBRole';
//import getUsers from "src/auth/queries/getUsers";
//import updateUserFromGrid from "src/auth/mutations/updateUserFromGrid";
//import SoftDeleteUserMutation from "src/auth/mutations/deleteUser";
//import NewUserMutationSpec from "src/auth/mutations/signup";
//import NewUserMutationSpec from "src/auth/mutations/newUser";


// name                String
// description         String // what's the diff between a description & comment? description is the pinned general description in markdown.
// startsAt            DateTime
// endsAt              DateTime
// locationDescription String   @default("")
// locationURL         String   @default("")
// isDeleted           Boolean  @default(false)
// isCancelled         Boolean  @default(false) // used as an input for calculating status



export const NewUserDialogSpec: CMNewItemDialogSpec<DBEvent> = {
    InitialObj: {
        name: "",
        email: "",
        password: "1234567890!@#$%^&aoeuAOEU",
    },
    ZodSchema: NewEventSchema,

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

export const EventsEditGridSpec: CMEditGridSpec<DBEvent> = {
    PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"

    CreateMutation: NewUserMutationSpec,
    GetPaginatedItemsQuery: getUsers,
    UpdateMutation: updateUserFromGrid, // support editing of grid columns
    DeleteMutation: SoftDeleteUserMutation, // by pk alone

    PageSizeOptions: [3, 25, 100],
    PageSizeDefault: 25,

    CreateItemButtonText: () => `New user`,
    CreateSuccessSnackbar: (item: DBEvent) => `User ${item.name} added`,
    CreateErrorSnackbar: (err: any) => `Server error while adding user`,
    UpdateItemSuccessSnackbar: (updatedItem: DBEvent) => `User ${updatedItem.name} updated.`,
    UpdateItemErrorSnackbar: (err: any) => `Server error while updating user`,
    DeleteItemSuccessSnackbar: (updatedItem: DBEvent) => `deleted user success`,
    DeleteItemErrorSnackbar: (err: any) => `deleted user error`,
    NoChangesMadeSnackbar: (item: DBEvent) => "No changes were made",
    DeleteConfirmationMessage: (item: DBEvent) => `Pressing 'Yes' will delete '${item.name}'`,
    UpdateConfirmationMessage: (oldItem: DBEvent, newItem: DBEvent, mutation: any[]) => `Pressing 'Yes' will update user ${oldItem.name}`,
    DefaultOrderBy: { id: "asc" },

    ComputeDiff: (oldItem: DBEvent, newItem: DBEvent) => { // return an array of changes made. must be falsy if equal
        if (newItem.name !== oldItem.name) {
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
