import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { BandSelection } from "src/core/components/dashboard/BandSelection";
import { useLocale } from "src/locale/components/useLocale";

const PlatformDashboard: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("dashboard.title")}><BandSelection /></DashboardLayout>;
};

export default PlatformDashboard;
