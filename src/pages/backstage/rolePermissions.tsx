import { defineCmdbPage } from "src/route/cmdbPage";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { RolePermissionMatrixContent } from "src/core/components/user/RoleAdministration";
import { useLocale } from "src/locale/components/useLocale";

function RolePermissionsPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("roles.matrix")}><RolePermissionMatrixContent /></DashboardLayout>;
}

defineCmdbPage("bandRolePermissions", RolePermissionsPage);
export default RolePermissionsPage;
