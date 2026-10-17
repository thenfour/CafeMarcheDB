import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { BandMemberRecovery } from "src/core/components/user/BandMemberRecovery";
import { useLocale } from "src/locale/components/useLocale";

const RecoverMembersPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.lifecycle.recoveryTitle")}><BandMemberRecovery /></DashboardLayout>;
};
defineCmdbPage("bandRecoverMembers", RecoverMembersPage);
export default RecoverMembersPage;
