import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { MenuLinkList } from "@/src/core/components/dashboard/MenuLinkComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";


const MyContent = () => {
    return <div>
        <SettingMarkdown setting="MenuLinksPageMarkdown" />
        <MenuLinkList />
    </div>;
};

const MenuLinksPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Menu Links" basePermission={Permission.customize_menu}>
            <Suspense fallback="Loading...">
                <MyContent />
            </Suspense>
        </DashboardLayout>
    );
}

export default MenuLinksPage;
