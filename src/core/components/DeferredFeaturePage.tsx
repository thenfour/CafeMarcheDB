import { Alert } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import DashboardLayout from "./dashboard/DashboardLayout";
import { QuickSearchRecoveryNotice } from "./search/QuickSearchRecoveryNotice";

/** Keep the report URL usable while its readers are being migrated. */
export function DeferredActivityReportsPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("recovery.activityReports.title")}>
        <Alert severity="info">{locale.getPlainString("recovery.activityReports.description")}</Alert>
    </DashboardLayout>;
}

/** Preserve the protected explorer URL without mounting a global search reader. */
export function DeferredQuickSearchPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("recovery.quickSearch.title")}>
        <QuickSearchRecoveryNotice />
    </DashboardLayout>;
}
