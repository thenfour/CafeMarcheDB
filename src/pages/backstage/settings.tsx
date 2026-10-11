import type { BlitzPage } from "@blitzjs/next";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useLocale } from "src/locale/components/useLocale";
import { RegisteredSettingsEditor } from "src/setting/client/components/RegisteredSettingsEditor";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

const SettingsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("settings.title")}>
        <CMSinglePageSurfaceCard>
            <div className="content muiCompatible">
                <BandLocalizedMarkdown id="settings_markdown" />
                <RegisteredSettingsEditor />
            </div>
        </CMSinglePageSurfaceCard>
    </DashboardLayout>;
};

export default SettingsPage;
