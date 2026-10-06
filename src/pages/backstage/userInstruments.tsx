import React from "react";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { MemberInstrumentsControl } from "src/core/components/user/BandUserInstruments";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";
import { useLocale } from "src/locale/components/useLocale";

const UserInstrumentsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.instruments.title")}>
        <LocalizedMarkdown setting="UserInstrumentsPage_markdown" />
        <MemberInstrumentsControl own={false} />
    </DashboardLayout>;
};

export default UserInstrumentsPage;
