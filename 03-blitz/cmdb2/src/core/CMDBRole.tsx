import {
    Security as SecurityIcon
} from '@mui/icons-material';
import {
    ListItemIcon, ListItemText
} from "@mui/material";
import Chip from '@mui/material/Chip';
import { Role as DBRole } from "db";
import CreateRoleMutation from "src/auth/mutations/createRole";
import GetAllRolesQuery from "src/auth/queries/getAllRoles";
import { CMAutocompleteFieldSpec, CMGridEditCellSpec, CMSelectItemDialogSpec, CreateFromStringParams, RenderItemParams } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";

export const RoleAutocompleteSpec: CMAutocompleteFieldSpec<DBRole> = {
    GetAllItemsQuery: GetAllRolesQuery,
    CreateFromStringMutation: CreateRoleMutation,
    CreateFromString: async (params: CreateFromStringParams<DBRole>) => {
        return await params.mutation({ name: params.input, description: "" });
    },
    MatchesExactly: (value: DBRole, input: string) => { // used by autocomplete to know if the item created by single text string already exists
        return value.name.trim() == input;
    },
    GetStringCaptionForValue: (value: DBRole) => {
        return value.name;
    },
    IsEqual: (item1, item2) => {
        if (!item1 && !item2) return true; // both considered null.
        return item1?.id == item2?.id;
    },
    RenderListItemChild({ obj }) {
        return <>
            <SecurityIcon />
            {obj.name}
        </>;
    },
    NewItemSuccessSnackbarText: (obj) => `Created new role ${obj?.name || "<error>"}`,
    NewItemErrorSnackbarText: (err) => `Failed to create new role.`,
    VirtualNewItemText: (inputText) => `Add "${inputText || "<error>"}"`,
    PlaceholderText: () => `Select a role`,
};

export const RenderRole = (params: RenderItemParams<DBRole>) => {
    return !params.value ?
        <>--</> :
        <Chip
            size="small"
            label={`${params.value.name}`}
            onClick={params.onClick ? () => { params.onClick!(params.value) } : undefined}
            onDelete={params.onDelete ? () => { params.onDelete!(params.value) } : undefined}
        />;
};

export const RoleSelectItemDialogSpec: CMSelectItemDialogSpec<DBRole> = {
    GetAllItemsQuery: RoleAutocompleteSpec.GetAllItemsQuery,
    CreateFromStringMutation: RoleAutocompleteSpec.CreateFromStringMutation,
    CreateFromString: RoleAutocompleteSpec.CreateFromString,
    IsEqual: RoleAutocompleteSpec.IsEqual,
    RenderListItemChild: (value: DBRole) => {
        return <>
            <ListItemIcon>
                <SecurityIcon />
            </ListItemIcon>
            <ListItemText
                primary={value.name}
                secondary={value.description}
            />
        </>;
    },
    RenderItem: RenderRole,

    NewItemSuccessSnackbarText: RoleAutocompleteSpec.NewItemSuccessSnackbarText,
    NewItemErrorSnackbarText: RoleAutocompleteSpec.NewItemErrorSnackbarText,
    DialogTitleText: RoleAutocompleteSpec.PlaceholderText,
    NewItemText: RoleAutocompleteSpec.VirtualNewItemText,
    GetQuickFilterWhereClauseExpression: (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
        return [
            { name: { contains: query } },
            { description: { contains: query } },
        ];
    },
};

export const RoleGridEditCellSpec: CMGridEditCellSpec<DBRole> = {
    ForeignPKIDMemberName: "id",
    FKObjectMemberName: "role",
    FKIDMemberName: "roleId",
    RenderItem: RenderRole,
    SelectItemDialogSpec: RoleSelectItemDialogSpec,
    GetIDOfFieldValue: (value?) => (value?.id || null),
};

