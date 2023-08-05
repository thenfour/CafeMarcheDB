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
} from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { RoleAutocompleteSpec } from "./CMDBRole";
import { CMTextField } from './cmdashboard/CMTextField';
import { Permission } from "../../shared/permissions";
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
            const exists = !!rolePermission;
            return (
                <IconButton onClick={() => ggparams.handleClick_simpleToggle(rcparams)}>{exists ? <RadioButtonCheckedIcon color="success" /> : <RadioButtonUncheckedIcon color="disabled" />}</IconButton>
            );
        },
        renderHeader(params) {
            return <Tooltip title={`Role: ${obj.name}`}><span>{obj.name}</span></Tooltip>;
        },
    } as Partial<GridColDef>),
};


export default {
    RolePermissionEditGridSpec
};

