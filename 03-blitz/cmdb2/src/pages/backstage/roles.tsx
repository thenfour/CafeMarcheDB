import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { RoleClientSchema } from "src/core/db3/DB3ClientSchema";

const MainContent = () => {
    if (!useAuthorization("admin roles page", Permission.admin_auth)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="RolesAdminPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={RoleClientSchema} />
    </>;
};

const RolesListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="User Roles">
            <MainContent />
        </DashboardLayout>
    );
};

export default RolesListPage;
