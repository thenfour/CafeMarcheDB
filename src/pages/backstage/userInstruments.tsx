import { defineCmdbPage } from "src/route/cmdbPage";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { MemberInstrumentsControl } from "src/core/components/user/BandUserInstruments";
import { useLocale } from "src/locale/components/useLocale";
import { Localized } from "@/src/locale/components/Localized";

const UserInstrumentsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.instruments.title")}>
        <Localized id="UserInstrumentsPage_markdown" />
        <MemberInstrumentsControl own={false} />
    </DashboardLayout>;
};

defineCmdbPage("bandUserInstruments", UserInstrumentsPage);
export default UserInstrumentsPage;
