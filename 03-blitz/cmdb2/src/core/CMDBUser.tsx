import {
    Person as UserIcon
} from '@mui/icons-material';
import {
    ListItemIcon, ListItemText
} from "@mui/material";
import Chip from '@mui/material/Chip';
import { User as DBUser } from "db";
import { CMColumnSpec, CMNewItemDialogSpec, CreateFromStringParams, GetCaptionParams, GetCaptionReasons, RenderItemParams } from "src/core/cmdashboard/CMColumnSpec";
import { Signup as NewUserSchema } from "src/auth/schemas";

// export const UserSpec: CMColumnSpec<DBUser> =
// {
//     PKID: "id",
//     FKObjectFieldName: "user",
//     FKIDFieldName: "userId",
//     GetAllItemsQuery: null,
//     CreateFromStringMutation: null,
//     CreateFromString: null,
//     MatchesExactly: (value: DBUser, input: string) => { // used by autocomplete to know if the item created by single text string already exists
//         return value.name.trim() == input;
//     },
//     GetStringCaptionForValue: (value: DBUser) => {
//         return value.name;
//     },
//     GetCaption({ reason, obj, err, inputString }: GetCaptionParams<DBUser>) {
//         switch (reason) {
//             case GetCaptionReasons.AutocompleteCreatedItemSnackbar:
//                 return `Created new user ${obj?.name || "<error>"}`;
//             case GetCaptionReasons.AutocompleteInsertErrorSnackbar:
//                 return `Failed to create new user.`;
//             case GetCaptionReasons.AutocompleteInsertVirtualItemCaption:
//                 return `Add "${inputString || "<error>"}"`
//             case GetCaptionReasons.AutocompletePlaceholderText:
//             case GetCaptionReasons.SelectItemDialogTitle:
//                 return `Select a user`;
//         }
//         return `${obj?.name || "(none)"} reason=${reason}`;
//     },
//     RenderAutocompleteItem({ obj }) {
//         return <>
//             <UserIcon />
//             {obj.name}
//         </>;
//     },
//     RenderItem(params: RenderItemParams<DBUser>) {
//         return !params.value ?
//             <>--</> :
//             <Chip
//                 size="small"
//                 label={`${params.value.name}`}
//                 onClick={params.onClick ? () => { params.onClick(params.value) } : undefined}
//                 onDelete={params.onDelete ? () => { params.onDelete(params.value) } : undefined}
//             />;
//     },
//     IsEqual: (item1, item2) => {
//         if (!item1 && !item2) return true; // both considered null.
//         return item1?.id == item2?.id;
//     },
//     RenderSelectListItemChildren: (value: DBUser) => {
//         return <>
//             <ListItemIcon>
//                 <UserIcon />
//             </ListItemIcon>
//             <ListItemText
//                 primary={value.name}
//                 secondary={value.description}
//             />
//         </>;
//     },
// };

export const NewUserDialogSpec: CMNewItemDialogSpec<DBUser> = {
    InitialObj: {
        name: "",
        email: "",
        password: "1234567890!@#$%^&aoeuAOEU",
    },
    ZodSchema: NewUserSchema,
};

