// we cannot use our normal EditGrid for this, because CMEditGrid treats rows like DB rows.
// and that's pretty deep into the UX and logic.
// here we need CELLS to act like DB rows.

import { BlitzPage } from "@blitzjs/next";
import { FormControlLabel, Tooltip } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3AssociationMatrix } from "src/core/db3/components/DB3AssociationMatrix";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";


const MainContent = () => {
    const [showUnknown, setShowUnknown] = React.useState<boolean>(false);

    const RoleClientSchema = new DB3Client.xTableClientSpec({
        table: db3.xRole,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isRoleForNewUsers" }),
            new DB3Client.TagsFieldClient({ columnName: "permissions", cellWidth: 300, allowDeleteFromCell: false }),
        ],
    });


    const PermissionClientSchema = new DB3Client.xTableClientSpec({
        table: db3.xPermission,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isVisibility" }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 120 }),
            new DB3Client.IconFieldClient({ columnName: "iconName", cellWidth: 120 }),
            new DB3Client.TagsFieldClient({ columnName: "roles", cellWidth: 300, allowDeleteFromCell: false }),
        ],
    });

    const codePermissions = Object.keys(Permission);

    return <>
        <SettingMarkdown setting="rolePermissionsMatrixPage_markdown"></SettingMarkdown>
        <FormControlLabel label="Show unknown permissions" control={<input type="checkbox" checked={showUnknown} onChange={(e) => setShowUnknown(e.target.checked)} />} />
        <DB3AssociationMatrix
            localTableSpec={PermissionClientSchema}
            foreignTableSpec={RoleClientSchema}
            tagsField={PermissionClientSchema.getColumn("roles") as DB3Client.TagsFieldClient<db3.RolePermissionAssociationPayload>}
            filterRow={(row: db3.PermissionPayloadMinimum) => {
                if (showUnknown) return true;
                return codePermissions.some(k => k === row.name);
            }}
            renderExtraActions={(x) => {
                return <div style={{ display: "flex" }}>{x.row.sortOrder}{codePermissions.some(k => k === x.row.name) ? (
                    <Tooltip title="this permission is in sync with code."><div>🟢</div></Tooltip>)
                    : (<Tooltip title="this permission is not known in code; it can probably be deleted.">
                        <div style={{ display: "flex", whiteSpace: "nowrap" }}>🟥Unknown</div></Tooltip>)}</div>
            }}
        />
    </>;
};


const RolePermissionsMatrixPage: BlitzPage = () => {
    return (
        <DashboardLayout title="RolePerm Matrix" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    );
};

export default RolePermissionsMatrixPage;
