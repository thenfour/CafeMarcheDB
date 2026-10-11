import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { BandInstrumentCatalog } from "src/core/db3/components/BandInstrumentCatalog";
import { useLocale } from "src/locale/components/useLocale";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

const InstrumentListPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("instrument.title")}>
        <BandLocalizedMarkdown id="instrumentList_markdown" />
        <BandInstrumentCatalog />
    </DashboardLayout>;
};
export default InstrumentListPage;
