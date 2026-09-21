// we cannot use our normal EditGrid for this, because CMEditGrid treats rows like DB rows.
// and that's pretty deep into the UX and logic.
// here we need CELLS to act like DB rows.

import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { FormControlLabel, Tooltip } from "@mui/material";
import React from "react";
import { gPermissionOrdered } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3AssociationMatrix } from "src/core/db3/components/DB3AssociationMatrix";
import * as db3 from "src/core/db3/db3";


const MainContent = () => {
    const [showUnknown, setShowUnknown] = React.useState<boolean>(false);

    // association matrix still uses tablespecs and not views, use legacy.
    const RoleClientSchema = DB3Client.defineLegacyTableClientSpec({
        table: db3.xRole,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
            permissions: columnName => new DB3Client.TagsFieldClient({ columnName, cellWidth: 300, allowDeleteFromCell: false }),
        },
    });


    const PermissionClientSchema = DB3Client.defineLegacyTableClientSpec({
        table: db3.xPermission,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
            isVisibility: columnName => new DB3Client.BoolColumnClient({ columnName }),
            color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 120 }),
            iconName: columnName => new DB3Client.IconFieldClient({ columnName, cellWidth: 120 }),
            roles: columnName => new DB3Client.TagsFieldClient({ columnName, cellWidth: 300, allowDeleteFromCell: false, selectionView: db3.roleEditorView }),
        },
    });

    const codePermissions = gPermissionOrdered;

    return <>
        <SettingMarkdown setting="rolePermissionsMatrixPage_markdown"></SettingMarkdown>
        <FormControlLabel label="Show unknown permissions" control={<input type="checkbox" checked={showUnknown} onChange={(e) => setShowUnknown(e.target.checked)} />} />
        <DB3AssociationMatrix
            localTableSpec={PermissionClientSchema}
            foreignTableSpec={RoleClientSchema}
            tagsField={PermissionClientSchema.getColumn("roles") as DB3Client.TagsFieldClient<db3.RolePermissionAssociationPayload>}
            associationCommand={db3.setRolePermissionCommand}
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
        <DashboardLayout title="RolePerm Matrix">
            <MainContent />
        </DashboardLayout>
    );
};

export default RolePermissionsMatrixPage;
