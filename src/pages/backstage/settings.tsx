import { defineCmdbPage } from "src/route/cmdbPage";
import type { BlitzPage } from "@blitzjs/next";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useLocale } from "src/locale/components/useLocale";
import { RegisteredSettingsEditor } from "src/setting/client/components/RegisteredSettingsEditor";
import { Localized } from "@/src/locale/components/Localized";

const SettingsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("settings.title")}>
        <CMSinglePageSurfaceCard>
            <div className="content muiCompatible">
                <Localized id="settings_markdown" />
                <RegisteredSettingsEditor />
            </div>
        </CMSinglePageSurfaceCard>
    </DashboardLayout>;
};

defineCmdbPage("bandSettings", SettingsPage);
export default SettingsPage;
