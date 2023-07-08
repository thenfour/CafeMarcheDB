import { BlitzPage } from "@blitzjs/next";
import { PermissionEditGridSpec } from "src/core/CMDBPermission";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthenticatedSession } from "@blitzjs/auth";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";

const PermissionsListPage: BlitzPage = () => {
    //const x = useAuthenticatedSession();
    //const u = useCurrentUser();

    return (
        <DashboardLayout title="Users">
            <CMEditGrid spec={PermissionEditGridSpec} />
        </DashboardLayout>
    );
};

PermissionsListPage.authenticate = { role: Permission.can_edit_users };
//PermissionsListPage.authenticate = true;

export default PermissionsListPage;
