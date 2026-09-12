import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { MenuLinkList } from "@/src/core/components/dashboard/MenuLinkComponents";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";


const MyContent = () => {
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
