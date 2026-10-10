import React from "react";
import type { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { Permission } from "shared/permissions";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { ImportEventsPageContent } from "src/core/components/event/EventImportComponents";
import { useLocale } from "src/locale/components/useLocale";

function ImportContent() {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    if (!dashboard.authorizationContext?.bandPublicId || !dashboard.isAuthorized(Permission.sysadmin)) {
        return <Alert severity="info">{locale.getPlainString("eventImport.bandRequired")}</Alert>;
    }
    const contextKey = JSON.stringify([dashboard.requireBandPublicId(), dashboard.localePreferences]);
    return <ImportEventsPageContent key={contextKey} />;
}
const ImportEventsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("eventImport.title")}>
        <ImportContent />
    </DashboardLayout>;
};
export default ImportEventsPage;
