import { defineCmdbPage } from "src/route/cmdbPage";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { BandInstrumentCatalog } from "src/core/db3/components/BandInstrumentCatalog";
import { useLocale } from "src/locale/components/useLocale";
import { Localized } from "@/src/locale/components/Localized";

const InstrumentListPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("instrument.title")}>
        <Localized id="instrumentList_markdown" />
        <BandInstrumentCatalog />
    </DashboardLayout>;
};
defineCmdbPage("bandInstruments", InstrumentListPage);
export default InstrumentListPage;
