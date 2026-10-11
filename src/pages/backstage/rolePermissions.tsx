import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { RolePermissionMatrixContent } from "src/core/components/user/RoleAdministration";
import { useLocale } from "src/locale/components/useLocale";

export default function RolePermissionsPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("roles.matrix")}><RolePermissionMatrixContent /></DashboardLayout>;
}
