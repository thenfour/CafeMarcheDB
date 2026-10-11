import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { RoleDefinitionsContent } from "src/core/components/user/RoleAdministration";
import { useLocale } from "src/locale/components/useLocale";

export default function RolesPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("roles.title")}><RoleDefinitionsContent /></DashboardLayout>;
}
