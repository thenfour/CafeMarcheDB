import { Alert } from "@mui/material";
import { useLocale } from "src/locale/components/useLocale";
import DashboardLayout from "./dashboard/DashboardLayout";

/** Keep the existing role-administration URLs explicit during recovery. */
export function DeferredRoleAdministrationPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("recovery.accountRoles.title")}>
        <Alert severity="info">{locale.getPlainString("recovery.accountRoles.description")}</Alert>
    </DashboardLayout>;
}
