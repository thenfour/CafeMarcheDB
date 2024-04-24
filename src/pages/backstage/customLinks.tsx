import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { CustomLinkList } from "src/core/components/CustomLinksComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";




const MyContent = () => {
    useAuthorizationOrThrow("CustomLinksPage", Permission.view_custom_links);

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
