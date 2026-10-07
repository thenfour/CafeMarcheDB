import React, { Suspense } from "react";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { BandMemberDirectory } from "src/core/components/user/BandMemberDirectory";
import { useLocale } from "src/locale/components/useLocale";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

const UserSearchPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.directory.title")} navRealm={NavRealm.users}>
        <Suspense><LocalizedMarkdown setting="usersearch_markdown" /><BandMemberDirectory /></Suspense>
    </DashboardLayout>;
};
export default UserSearchPage;
