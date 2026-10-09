import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { MenuLinkList } from "@/src/core/components/dashboard/MenuLinkComponents";
import { Localized } from "@/src/setting/client/components/SettingMarkdown";
import { BlitzPage } from "@blitzjs/next";
import { Alert } from "@mui/material";
import { Suspense } from "react";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { useLocale } from "src/locale/components/useLocale";


const MyContent = () => {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    if (!dashboard.memberPresentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("menuLink.selectBand")}</Alert>;
    }
    return <div>
        <Alert severity="info">{locale.getPlainString("menuLink.deliveryDeferred")}</Alert>
        <Localized id="MenuLinksPageMarkdown" />
        <MenuLinkList key={dashboard.memberPresentation.bandPublicId} />
    </div>;
};

const MenuLinksPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Menu Links">
            <Suspense fallback="Loading...">
                <MyContent />
            </Suspense>
        </DashboardLayout>
    );
}

export default MenuLinksPage;
