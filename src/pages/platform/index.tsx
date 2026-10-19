import { defineCmdbPage } from "src/route/cmdbPage";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { MenuList } from "@mui/material";
import { BandMenuItems } from "src/core/components/dashboard/BandMenuItems";
import { useLocale } from "src/locale/components/useLocale";

const PlatformDashboard: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("dashboard.title")}>
        <MenuList><BandMenuItems /></MenuList>
    </DashboardLayout>;
};

defineCmdbPage("platformRoot", PlatformDashboard);
export default PlatformDashboard;
