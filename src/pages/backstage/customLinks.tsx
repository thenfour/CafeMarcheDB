import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { CustomLinkList } from "src/core/components/CustomLinksComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";




const MyContent = () => {
    const dashboardContext = useDashboardContext();

    if (!dashboardContext.isAuthorized(Permission.view_custom_links)) {
        throw new Error(`Unauthorized`);
    }

    return <div>
        <SettingMarkdown setting="CustomLinksPageMarkdown" />
        <CustomLinkList />
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
