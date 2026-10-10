import { Alert } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import DashboardLayout from "./dashboard/DashboardLayout";
import { QuickSearchRecoveryNotice } from "./search/QuickSearchRecoveryNotice";

/** Keep the existing role-administration URLs explicit during recovery. */
export function DeferredRoleAdministrationPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("recovery.accountRoles.title")}>
        <Alert severity="info">{locale.getPlainString("recovery.accountRoles.description")}</Alert>
    </DashboardLayout>;
}

/** Keep the report URL usable while its readers are being migrated. */
export function DeferredActivityReportsPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("recovery.activityReports.title")}>
        <Alert severity="info">{locale.getPlainString("recovery.activityReports.description")}</Alert>
    </DashboardLayout>;
}

/** Keep the audit URL explicit while its historical readers are being migrated. */
export function DeferredAuditLogPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("recovery.auditLog.title")}>
        <Alert severity="info">{locale.getPlainString("recovery.auditLog.description")}</Alert>
    </DashboardLayout>;
}

/** Preserve the protected explorer URL without mounting a global search reader. */
export function DeferredQuickSearchPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("recovery.quickSearch.title")}>
        <QuickSearchRecoveryNotice />
    </DashboardLayout>;
}
