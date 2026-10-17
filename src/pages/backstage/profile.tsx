import { defineCmdbPage } from "src/route/cmdbPage";
import type { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { OwnProfileContent } from "src/core/components/user/OwnAccountProfile";
import { ProfilePageIdentityControl } from "src/core/components/user/UserIdentityIndicator";
import { CalendarUserSettingsControl } from "src/core/components/user/UserSettingsControls";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

function ProfileContent() {
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    const personId = presentation.data?.authorization.userPublicId;
    const locale = useLocale();
    return <>
        <BandLocalizedMarkdown id="profile_markdown" />
        <CMSinglePageSurfaceCard className="surface2">
            <div className="header"><h1>{locale.getPlainString("membership.profile.ownTitle")}</h1></div>
            <div className="content">
                <BandLocalizedMarkdown id="profile_description_markdown" />
                {personId && <OwnProfileContent personId={personId} />}
                {dashboard.isAuthorized(Permission.sysadmin) && personId && <ProfilePageIdentityControl userId={personId} />}
            </div>
        </CMSinglePageSurfaceCard>
        <CMSinglePageSurfaceCard className="surface2">
            <div className="header"><h2>{locale.getPlainString("membership.profile.preferences")}</h2></div>
            <div className="content"><CalendarUserSettingsControl /></div>
        </CMSinglePageSurfaceCard>
    </>;
}

const ProfilePage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.profile.ownTitle")}>
        <Suspense><ProfileContent /></Suspense>
    </DashboardLayout>;
};
defineCmdbPage("bandProfile", ProfilePage);
export default ProfilePage;
