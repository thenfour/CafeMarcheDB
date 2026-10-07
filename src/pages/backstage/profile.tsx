import React, { Suspense } from "react";
import type { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { BandMemberProfile } from "src/core/components/user/BandMemberProfile";
import { ProfilePageIdentityControl } from "src/core/components/user/UserIdentityIndicator";
import { CalendarUserSettingsControl } from "src/core/components/user/UserSettingsControls";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { LocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

function ProfileContent() {
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    const personId = presentation.data?.authorization.userPublicId;
    return <>
        <LocalizedMarkdown setting="profile_markdown" />
        <LocalizedMarkdown setting="profile_description_markdown" />
        {personId && <BandMemberProfile personId={personId} />}
        {dashboard.isAuthorized(Permission.sysadmin) && personId && <ProfilePageIdentityControl userId={personId} />}
        <CalendarUserSettingsControl />
    </>;
}

const ProfilePage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.profile.title")}>
        <Suspense><ProfileContent /></Suspense>
    </DashboardLayout>;
};
export default ProfilePage;
