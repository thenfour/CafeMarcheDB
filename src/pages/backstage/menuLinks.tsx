import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { MenuLinkList } from "src/core/components/MenuLinkComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MyContent = () => {
    useAuthorizationOrThrow("MenuLinksPage", Permission.view_custom_links);

    return <div>
        <SettingMarkdown setting="MenuLinksPageMarkdown" />
        <MenuLinkList />
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
