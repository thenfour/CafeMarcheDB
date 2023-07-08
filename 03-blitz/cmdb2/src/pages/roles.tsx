import { BlitzPage } from "@blitzjs/next";
import { UserEditGridSpec } from "src/core/CMDBUser";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";

const RolesListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <CMEditGrid spec={UserEditGridSpec} />
        </DashboardLayout>
    );
};

//RolesListPage.authenticate = { role: [Permission.can_edit_users] };

export default RolesListPage;
