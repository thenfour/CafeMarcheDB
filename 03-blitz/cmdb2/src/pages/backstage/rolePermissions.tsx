// we cannot use our normal EditGrid for this, because CMEditGrid treats rows like DB rows.
// and that's pretty deep into the UX and logic.
// here we need CELLS to act like DB rows.

import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { InspectObject } from "src/core/components/CMCoreComponents";
//import { CMAssociationMatrix } from "src/core/cmdashboard/CMAssociationMatrix";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3AssociationMatrix } from "src/core/db3/components/DB3AssociationMatrix";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MainContent = () => {
    if (!useAuthorization("admin role-permissions matrix page", Permission.admin_auth)) {
        throw new Error(`unauthorized`);
    }

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


    return <>
        <SettingMarkdown settingName="rolePermissionsMatrixPage_markdown"></SettingMarkdown>
        <DB3AssociationMatrix
            localTableSpec={PermissionClientSchema}
            foreignTableSpec={RoleClientSchema}
            tagsField={PermissionClientSchema.getColumn("roles") as DB3Client.TagsFieldClient<db3.RolePermissionAssociationPayload>}
        />
    </>;
};


const RolePermissionsMatrixPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <MainContent />
        </DashboardLayout>
    );
};

export default RolePermissionsMatrixPage;
