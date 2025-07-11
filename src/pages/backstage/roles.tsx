import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";

const MainContent = () => {
    const RoleClientSchema = new DB3Client.xTableClientSpec({
        table: db3.xRole,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isRoleForNewUsers" }),
            new DB3Client.BoolColumnClient({ columnName: "isPublicRole" }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 120 }),
            new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 120 }),
            new DB3Client.TagsFieldClient({ columnName: "permissions", cellWidth: 300, allowDeleteFromCell: false }),
        ],
    });

    return <>
        <SettingMarkdown setting="RolesAdminPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={RoleClientSchema} />
    </>;
};

const RolesListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="User Roles" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    );
};

export default RolesListPage;
