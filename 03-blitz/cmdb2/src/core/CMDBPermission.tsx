// import { RolePermission as BaseRolePermission, Prisma } from "db";
// import React from "react";
// import { useQuery } from "@blitzjs/rpc";
// import {
//     Check as CheckIcon,
//     Security as SecurityIcon,
// } from '@mui/icons-material';
// import { Chip, ListItemIcon, ListItemText, Tooltip } from "@mui/material";
// import deletePermission from "src/auth/mutations/deletePermission";
// import insertPermission from "src/auth/mutations/insertPermission";
// import updatePermission from "src/auth/mutations/updatePermission";
// import getAllRoles from "src/auth/queries/getAllRoles";
// import getPaginatedPermissions from "src/auth/queries/getPaginatedPermissions";
// import { CreatePermission as CreatePermissionSchema } from "src/auth/schemas";
// import {
//     CMEditGridColumnType,
//     CMEditGridSpec,
//     CMGridEditCellMultiFKSpec,
//     CMNewItemDialogFieldSpec,
//     CMNewItemDialogSpec,
//     CMSelectMultiDialogSpec,
//     CreateEditGridColumnSpec,
//     RenderItemOfMultiParams,
//     RenderItemParams,
//     RenderMultiItemParams
// } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
// import { RoleAutocompleteSpec } from "./CMDBRole";
// import { CMTextField } from './cmdashboard/CMTextField';
// import { Permission } from "../../shared/permissions";
// import { ComputeChangePlan } from "shared/associationUtils";

// type DBPermission = Prisma.PermissionGetPayload<{
//     include: { roles: true }
// }>;
// type DBRolePermission = Prisma.RolePermissionGetPayload<{
//     include: { role: true, }
// }>;

// type DBRole = Prisma.RoleGetPayload<{}>;


// // UTILS //////////////////////////////////////////////////////////////////////////////////////////////

// export const GetRolePermissionID = (value: DBRolePermission) => `r:${value.roleId}::p:${value.permissionId}`;

// export const RenderRolePermission = ({ value, onDelete }: RenderItemParams<DBRolePermission>) => {
//     if (!value) {
//         return (<React.Fragment key="null_item"></React.Fragment>);
//     }
//     return (<Chip
//         key={GetRolePermissionID(value)}
//         size="small"
//         label={`${value.role.name}`}
//         onDelete={onDelete && (() => onDelete!(value))}
//     />);
// };

// export const RenderPermissionRoleList = ({ value: value_, onDelete }: RenderMultiItemParams<DBPermission, DBRolePermission>) => {
//     const value = value_ || [] as DBRolePermission[];
//     return <>{value.map(p => RenderRolePermission({ value: p, onDelete }))}</>;
// };

// // export const IsEqualAssociation = (item1: BaseRolePermission, item2: BaseRolePermission) => {
// //     if (!item1 && !item2) return true; // both considered null.
// //     return (item1?.roleId == item2?.roleId) && (item1?.permissionId == item2?.permissionId);
// // };

// export const IsEqualAssociation = (item1: DBRolePermission, item2: DBRolePermission) => {
//     if (!item1 && !item2) return true; // both considered null.
//     return (item1?.roleId == item2?.roleId) && (item1?.permissionId == item2?.permissionId);
// };

// export const CreateAssociation = (permissionId, role: DBRole) => {
//     console.assert(!!role);
//     console.assert(!!role.id);
//     return {
//         id: -1,// should never be used.
//         permissionId,
//         roleId: role.id,
//         role: role,
//         // don't include permission here for simplicity (circular)
//     } as DBRolePermission;
// };

// export const GetQuickFilterWhereClauseExpression = (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
//     return [
//         { name: { contains: query } },
//         { description: { contains: query } },
//     ];
// };

// export const ComputeDiff = (oldItem: DBPermission, newItem: DBPermission) => { // return an array of changes made. must be falsy if equal
//     if (newItem.name !== oldItem.name) {
//         return true;
//     }
//     if (newItem.description !== oldItem.description) {
//         return true;
//     }
//     if (newItem.sortOrder !== oldItem.sortOrder) {
//         return true;
//     }
//     const x = ComputeChangePlan(oldItem.roles, newItem.roles, IsEqualAssociation);
//     if (x.create.length || x.delete.length) {
//         return true;
//     }
//     return false;
// };


// // SPECS //////////////////////////////////////////////////////////////////////////////////////////////

// export const NewPermissionDialogSpec: CMNewItemDialogSpec<DBPermission> = {
//     InitialObj: {
//         name: "",
//         description: "",
//     },
//     ZodSchema: CreatePermissionSchema,

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
//                     value={value || ""}
//                     onChange={(e, val) => {
//                         return onChange(val);
//                     }}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<string>,
//         {
//             MemberName: "description",
//             IsForeignObject: false,
//             FKIDMemberName: undefined,
//             GetIDOfFieldValue: undefined,
//             RenderInputField: ({ key, validationErrors, onChange, value }) => {
//                 return (<CMTextField
//                     key={key}
//                     autoFocus={true}
//                     label="description"
//                     validationError={validationErrors["description"]}
//                     value={value || ""}
//                     onChange={(e, val) => onChange(val)}
//                 />);
//             },
//         } as CMNewItemDialogFieldSpec<string>,
//     ],

//     DialogTitle: () => `New permission`,
// };

// export const RoleSelectItemDialogSpec: CMSelectMultiDialogSpec<DBPermission, DBRolePermission> = {
//     GetQuickFilterWhereClauseExpression,
//     GetAllForeignItemOptionsAsAssociations: ({ existingAssociations, rowObject, where }) => {
//         const [roles, { refetch }] = useQuery(getAllRoles, { where });
//         const ret = roles.map(role => {
//             // if exists in existingAssociations, use that.
//             const existing = existingAssociations.find(eass => eass.roleId == role.id);
//             return existing || CreateAssociation(rowObject.id, role);
//         });
//         return { items: ret, refetch };
//     },

//     CreateAssociationWithNewForeignObjectFromString: async ({ input, mutation, rowObject }) => {
//         // cretae the foreign object
//         const newRole = await mutation({ name: input, description: 'auto-created via permissions' }) as DBRole;
//         // create the association
//         return CreateAssociation(rowObject.id, newRole);
//     },

//     CreateForeignFromStringMutation: RoleAutocompleteSpec.CreateFromStringMutation, // allows creating a TForeignModel from a single string value

//     RenderListItemChild: ({ rowObject, selected, value }) => {
//         return <>
//             <ListItemIcon>
//                 <SecurityIcon />
//             </ListItemIcon>
//             {selected && <ListItemIcon>
//                 <CheckIcon />
//             </ListItemIcon>
//             }
//             <ListItemText
//                 primary={value.role.name}
//                 secondary={value.role.description}
//             />
//         </>;
//     }, // react component; render the item in a select dialog
//     RenderValue: RenderPermissionRoleList,
//     IsEqualAssociation,
//     GetKey: GetRolePermissionID, // for react list keys

//     NewItemSuccessSnackbarText: (obj: DBRolePermission) => `created role.`,
//     NewItemErrorSnackbarText: (err: any) => `error text`,
//     DialogTitleText: () => `Select roles to associate with this permission.`,
//     NewItemText: (inputText: string) => `Add '${inputText}'`,
// };


// export const PermissionRoleSpec: CMGridEditCellMultiFKSpec<DBPermission, DBRolePermission> = {
//     SelectMultiDialogSpec: RoleSelectItemDialogSpec,
//     RenderEditCellValue: ({ value, onDelete }: RenderItemOfMultiParams<DBPermission, DBRolePermission>) => {
//         if (!value.length) return <>--</>;
//         return <>{value.map(ass => RenderRolePermission({ value: ass, onDelete }))}</>;
//     },
// };


// export const PermissionEditGridSpec: CMEditGridSpec<DBPermission> = {
//     PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"

//     CreateMutation: insertPermission,
//     GetPaginatedItemsQuery: getPaginatedPermissions,
//     UpdateMutation: updatePermission, // support editing of grid columns
//     DeleteMutation: deletePermission, // by pk alone

//     PageSizeOptions: [3, 25, 100],
//     PageSizeDefault: 25,

//     CreateItemButtonText: () => `New permission`,
//     CreateSuccessSnackbar: (item: DBPermission) => `permission ${item.name} added`,
//     CreateErrorSnackbar: (err: any) => `Server error while adding permission`,
//     UpdateItemSuccessSnackbar: (updatedItem: DBPermission) => `permission ${updatedItem.name} updated.`,
//     UpdateItemErrorSnackbar: (err: any) => `Server error while updating permission`,
//     DeleteItemSuccessSnackbar: (item: DBPermission) => `permission ${item.name} deleted.`,
//     DeleteItemErrorSnackbar: (err: any) => `Server error while deleting permission`,
//     NoChangesMadeSnackbar: (item: DBPermission) => "No changes were made",
//     DeleteConfirmationMessage: (item: DBPermission) => `Pressing 'Yes' will delete '${item.name}'`,
//     UpdateConfirmationMessage: (oldItem: DBPermission, newItem: DBPermission, mutation: any[]) => `Pressing 'Yes' will update permission ${oldItem.name}`,
//     DefaultOrderBy: { id: "asc" },
//     ComputeDiff,
//     GetQuickFilterWhereClauseExpression,

//     NewItemDialogSpec: NewPermissionDialogSpec,

//     Columns: [
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.PK, MemberName: "id", Editable: false, }),
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.UInt16, MemberName: "sortOrder", Editable: true, }),
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "name", Editable: true, }),
//         CreateEditGridColumnSpec({ Behavior: CMEditGridColumnType.String, MemberName: "description", Editable: true, }),
//         CreateEditGridColumnSpec({
//             Behavior: CMEditGridColumnType.Custom,
//             MemberName: "status",
//             Editable: false,
//             GridColProps: {
//                 renderCell: (params) => {
//                     const dbname = params.row.name;
//                     if (Object.values(Permission).find(p => p === dbname)) {
//                         return (<Tooltip title="This permission is understood by internal code; all permissions should have this state."><Chip size="small" color="primary" label="Ok" variant="outlined" /></Tooltip>);
//                     } else {
//                         return (<Tooltip title="This permission is unknown by internal code. It won't be used by anything unless code changes are made. Is it obsolete? Typo in the name?"><Chip size="small" color="error" label="Unknown" variant="outlined" /></Tooltip>);
//                     }
//                 }
//             }
//         }),
//         CreateEditGridColumnSpec({
//             Behavior: CMEditGridColumnType.MultiForeignObjects,
//             Width: 300,
//             MemberName: "roles",
//             Editable: true,
//             FKEditCellMultiSpec: PermissionRoleSpec,
//             FKRenderViewCell: RenderPermissionRoleList,
//         }),
//     ],
// };
