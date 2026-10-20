import { defineCmdbPage } from "src/route/cmdbPage";
import type { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "src/core/components/dashboard/StaticMenuItems";
import { BandMemberDirectory } from "src/core/components/user/BandMemberDirectory";
import { useLocale } from "src/locale/components/useLocale";
import { Localized } from "@/src/locale/components/Localized";

const UserSearchPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.directory.title")} navRealm={NavRealm.users}>
        <Suspense>
            <Localized id="usersearch_markdown" />
            <BandMemberDirectory />
        </Suspense>
    </DashboardLayout>;
};
defineCmdbPage("bandUsers", UserSearchPage);
export default UserSearchPage;
