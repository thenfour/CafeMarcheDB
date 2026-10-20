import { defineCmdbPage } from "src/route/cmdbPage";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { BandInstrumentCatalog } from "src/core/db3/components/BandInstrumentCatalog";
import { useLocale } from "src/locale/components/useLocale";
import { Localized } from "@/src/locale/components/Localized";

const InstrumentFunctionalGroupListPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("instrument.groupsTitle")}>
        <Localized id="InstrumentFunctionalGroupList_markdown" />
        <BandInstrumentCatalog mode="group" />
    </DashboardLayout>;
};
defineCmdbPage("bandInstrumentFunctionalGroups", InstrumentFunctionalGroupListPage);
export default InstrumentFunctionalGroupListPage;
