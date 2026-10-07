import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { CustomLinkList } from "src/core/components/CustomLinksComponents";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { Alert } from "@mui/material";
import { useLocale } from "src/locale/components/useLocale";




const MyContent = () => {
    const dashboardContext = useDashboardContext();
    const locale = useLocale();

    if (!dashboardContext.memberPresentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("customLink.selectBand")}</Alert>;
    }

    if (!dashboardContext.isAuthorized(Permission.view_custom_links)) {
        throw new Error(`Unauthorized`);
    }

    return <div>
        <LocalizedMarkdown setting="CustomLinksPageMarkdown" />
        <CustomLinkList key={dashboardContext.memberPresentation.bandPublicId} />
    </div>;
};

const CustomLinksPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Custom Links">
            <Suspense fallback="Loading...">
                <MyContent />
            </Suspense>
        </DashboardLayout>
    );
}

export default CustomLinksPage;
