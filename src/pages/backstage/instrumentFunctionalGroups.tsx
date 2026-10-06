import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { BandInstrumentCatalog } from "src/core/db3/components/BandInstrumentCatalog";
import { useLocale } from "src/locale/components/useLocale";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

const InstrumentFunctionalGroupListPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("instrument.groupsTitle")}>
        <LocalizedMarkdown setting="InstrumentFunctionalGroupList_markdown" />
        <BandInstrumentCatalog mode="group" />
    </DashboardLayout>;
};
export default InstrumentFunctionalGroupListPage;
