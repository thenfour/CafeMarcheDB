import { RolePermission as BaseRolePermission, Prisma } from "db";
import React from "react";
import { useQuery } from "@blitzjs/rpc";
import {
    Check as CheckIcon,
    Security as SecurityIcon,
    RadioButtonChecked as RadioButtonCheckedIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import { Button, Chip, IconButton, ListItemIcon, ListItemText, Tooltip } from "@mui/material";
import deletePermission from "src/auth/mutations/deletePermission";
import insertPermission from "src/auth/mutations/insertPermission";
import updatePermission from "src/auth/mutations/updatePermission";
import getAllRoles from "src/auth/queries/getAllRoles";
import getPaginatedPermissions from "src/auth/queries/getPaginatedPermissions";
import { CreatePermission as CreatePermissionSchema } from "src/auth/schemas";
import {
    CMAssociationMatrixSpec,
    CMEditGridColumnType,
    CMEditGridSpec,
    CMGridEditCellMultiFKSpec,
    CMNewItemDialogFieldSpec,
    CMNewItemDialogSpec,
    CMSelectMultiDialogSpec,
    CreateEditGridColumnSpec,
    RenderItemOfMultiParams,
    RenderItemParams,
    RenderMultiItemParams
} from "src/core/cmdashboard/CMColumnSpec";
import { RoleAutocompleteSpec } from "./CMDBRole";
import { CMTextField } from './cmdashboard/CMTextField';
import { Permission } from "../../shared/permissions";
import AU from "shared/associationUtils";
import getPaginatedRoles from "src/auth/queries/getPaginatedRoles";
import getAllPermissions from "src/auth/queries/getAllPermissions";
import getRolesForMatrix from "src/auth/queries/getRolePermissionsForMatrix";
import { GridColDef } from "@mui/x-data-grid";
import getRolePermissionsForMatrix from "src/auth/queries/getRolePermissionsForMatrix";
import toggleRolePermission from "src/auth/mutations/toggleRolePermission";

type DBRolePermission = Prisma.RolePermissionGetPayload<{
    include: { role: true, permission: true }
}>;

type DBRole = Prisma.RoleGetPayload<{}>;

type DBPermission = Prisma.PermissionGetPayload<{}>;

const Role_GetQuickFilterWhereClauseExpression = (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
    return [
        { name: { contains: query } },
        { description: { contains: query } },
    ];
};

// const RolePermissionEditGridSpec: CMEditGridSpec<DBRolePermission> = {
//     PKIDMemberName: "id", // field name of the primary key ... almost always this should be "id"

//     CreateMutation: insertPermission,
//     GetPaginatedItemsQuery: getPaginatedPermissions,
//     UpdateMutation: updatePermission, // support editing of grid columns
//     DeleteMutation: deletePermission, // by pk alone

//     PageSizeOptions: [3, 25, 100],
//     PageSizeDefault: 25,

//     CreateItemButtonText: () => `New permission`,
//     CreateSuccessSnackbar: (item: DBRolePermission) => `role ${item.role.name} now associated with ${item.permission.name}`,
//     CreateErrorSnackbar: (err: any) => `Server error while associating role-permission`,
//     UpdateItemSuccessSnackbar: (updatedItem: DBRolePermission) => `role ${updatedItem.role.name} now associated with ${updatedItem.permission.name}`,
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


// so i kinda want to support 2 different kind of association matrices:
// 1. where you simply click to switch the cell value
// 2. where associations are more complex objects with editors.

// i guess #1 is easy enough, and we can consider #2 later.
// now, are the mutations managed by the grid, or by the spec?
// i'd like to make it managed by the grid.

const RolePermissionEditGridSpec: CMAssociationMatrixSpec<DBRole, DBRolePermission, DBPermission> = {
    PageSizeOptions: [20, 50, 100],
    PageSizeDefault: 50,
    DefaultOrderBy: { id: "asc" },
    GetQuickFilterWhereClauseExpression: Role_GetQuickFilterWhereClauseExpression,
    GetPaginatedRowsIncludingAssociationsQuery: getRolePermissionsForMatrix,
    GetRowFieldForColumn: (obj: DBRole) => `${obj.id}`, // 
    GetColumnHeading: (obj: DBRole) => obj.name,
    RowPKField: "id",
    RowNameField: "name",
    ToggleMutation: toggleRolePermission,
    ToggleSuccessSnackbar: (oldObj: DBRolePermission | null, newObj: DBRolePermission | null) => `successfully toggled`,
    ToggleErrorSnackbar: (err: any) => `error htoggling`,
    GetGridColumnProps: (obj: DBRole, ggparams) => ({
        width: 90,
        renderCell(rcparams) {
            const rolePermission = rcparams.row[rcparams.colDef.field] as DBRolePermission;
            //if (!rolePermission) {
            //return <Button onClick={() => ggparams.handleClick_simpleToggle(rcparams)}>{!!rolePermission ? }</Button>;
            return (
                <IconButton onClick={() => ggparams.handleClick_simpleToggle(rcparams)}>{!!rolePermission ? <RadioButtonCheckedIcon /> : <RadioButtonUncheckedIcon />}</IconButton>
            );
            //}
            //return <Button onClick={() => alert('lol')}>{`r:${rolePermission.role.name}::p:${rolePermission.permissionId}`}</Button>;
            //return <Button onClick={() => ggparams.handleClick_toggleOff(rcparams)}>(FILLED)</Button>;
        },
        renderHeader(params) {
            return <Tooltip title={`Role: ${obj.name}`}><span>{obj.name}</span></Tooltip>;
        },
    } as Partial<GridColDef>),
};


export default {
    RolePermissionEditGridSpec
};

