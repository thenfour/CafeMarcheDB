import { Prisma } from "db";
import { CreateSettingSchema, SettingNameSchema, SettingValueSchema, UpdateSettingByIdSchema } from "src/auth/schemas";
import {
    CMEditGridColumnType,
    CMEditGridSpec,
    CMNewItemDialogFieldSpec,
    CMNewItemDialogSpec,
    CMTableSpec,
    CreateEditGridColumnSpec,
    PKIDField,
    SimpleTextField
} from "src/core/cmdashboard/CMColumnSpec";
import { CMTextField } from './cmdashboard/CMTextField';
import getPaginatedSettings from "src/auth/queries/getPaginatedSettings";
import deleteSetting from "src/auth/mutations/deleteSetting";
import insertSetting from "src/auth/mutations/insertSetting";
import updateSettingById from "src/auth/mutations/updateSettingById";

type DBSetting = Prisma.SettingGetPayload<{
    //includes?
}>;


export const SettingTableSpec = new CMTableSpec<DBSetting>({
    devName: "setting",
    CreateMutation: insertSetting,
    CreateSchema: CreateSettingSchema,
    GetPaginatedItemsQuery: getPaginatedSettings,
    UpdateMutation: updateSettingById,
    UpdateSchema: UpdateSettingByIdSchema,
    DeleteMutation: deleteSetting,
    GetNameOfRow: (row: DBSetting) => { return row.name; },
    renderForListItemChild: ({ obj }) => {
        return <>an item?</>;
    },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ label: "name", member: "name", initialNewItemValue: "", zodSchema: SettingNameSchema, cellWidth: 220 }),
        new SimpleTextField({ label: "value", member: "value", initialNewItemValue: "", zodSchema: SettingValueSchema, cellWidth: 550 }),
    ],
});


//     CreateMutation: insertSetting,
//     GetPaginatedItemsQuery: getPaginatedSettings,
//     UpdateMutation: updateSettingById, // support editing of grid columns
//     DeleteMutation: deleteSetting, // by pk alone




// export const GetQuickFilterWhereClauseExpression = (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
//     return [
//         { name: { contains: query } },
//         { value: { contains: query } },
//     ];
// };

// export const ComputeDiff = (oldItem: DBSetting, newItem: DBSetting) => { // return an array of changes made. must be falsy if equal
//     if (newItem.name !== oldItem.name) {
//         return true;
//     }
//     if (newItem.value !== oldItem.value) {
//         return true;
//     }
//     return false;
// };


// // // SPECS //////////////////////////////////////////////////////////////////////////////////////////////

// export const NewSettingDialogSpec: CMNewItemDialogSpec<DBSetting> = {
//     InitialObj: {
//         name: "",
//         value: "",
//     },
//     ZodSchema: CreateSettingSchema,

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
//                         return onChange(val);
//                     }}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<string>,
//         {
//             MemberName: "value",
//             IsForeignObject: false,
//             FKIDMemberName: undefined,
//             GetIDOfFieldValue: undefined,
//             RenderInputField: ({ key, validationErrors, onChange, value }) => {
//                 return (<CMTextField
//                     key={key}
//                     autoFocus={false}
//                     label="value"
//                     validationError={validationErrors["value"]}
//                     value={value}
//                     onChange={(e, val) => onChange(val)}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<string>,
//     ],

//     DialogTitle: () => `New setting`,
// };

// export const SettingsEditGridSpec: CMEditGridSpec<DBSetting> = {
//     PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"

//     CreateMutation: insertSetting,
//     GetPaginatedItemsQuery: getPaginatedSettings,
//     UpdateMutation: updateSettingById, // support editing of grid columns
//     DeleteMutation: deleteSetting, // by pk alone

//     PageSizeOptions: [3, 25, 100],
//     PageSizeDefault: 25,

//     CreateItemButtonText: () => `New setting`,
//     CreateSuccessSnackbar: (item: DBSetting) => `setting ${item.name} added`,
//     CreateErrorSnackbar: (err: any) => `Server error while adding setting`,
//     UpdateItemSuccessSnackbar: (updatedItem: DBSetting) => `setting ${updatedItem.name} updated.`,
//     UpdateItemErrorSnackbar: (err: any) => `Server error while updating setting`,
//     DeleteItemSuccessSnackbar: (item: DBSetting) => `setting ${item.name} deleted.`,
//     DeleteItemErrorSnackbar: (err: any) => `Server error while deleting setting`,
//     NoChangesMadeSnackbar: (item: DBSetting) => "No changes were made",
//     DeleteConfirmationMessage: (item: DBSetting) => `Pressing 'Yes' will delete '${item.name}'`,
//     UpdateConfirmationMessage: (oldItem: DBSetting, newItem: DBSetting, mutation: any[]) => `Pressing 'Yes' will update setting ${oldItem.name}`,
//     DefaultOrderBy: { id: "asc" },
//     ComputeDiff,
//     GetQuickFilterWhereClauseExpression,

//     NewItemDialogSpec: NewSettingDialogSpec,

//     Columns: [
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.PK, MemberName: "id", Editable: false, Width: 50 }),
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "name", Editable: true, }),
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "value", Editable: true, }),
//     ],
// };



