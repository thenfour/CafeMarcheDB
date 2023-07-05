import { BlitzPage } from "@blitzjs/next";
import { PermissionEditGridSpec } from "src/core/CMDBPermission";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "src/core/permissions";

const RolesListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <CMEditGrid spec={PermissionEditGridSpec} />
        </DashboardLayout>
    );
};

RolesListPage.authenticate = { role: [Permission.can_edit_users] };

export default RolesListPage;
