import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { BigEventCalendar } from "src/core/components/EventCalendar";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { gIconMap } from "src/core/db3/components/IconMap";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const DynamicContent = () => {
  const [currentUser] = useCurrentUser();
  let noInstrumentsWarning = (currentUser?.instruments?.length || 0) < 1;
  let limitedAccountWarning = !!(currentUser?.role?.isRoleForNewUsers);

  return (<Suspense>

    {limitedAccountWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
      <div>{gIconMap.ErrorOutline()}</div>
      <div>By default your account has limited access. Please contact an admin to gain access to all site features.
      </div>
    </CMSinglePageSurfaceCard>}

    {noInstrumentsWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
      <div>{gIconMap.ErrorOutline()}</div>
      <div>You have no instruments assigned; please go to
        &nbsp;<a href="/backstage/profile">your profile</a>&nbsp;
        and specify your instruments.
      </div>
    </CMSinglePageSurfaceCard>}

    <SettingMarkdown setting="BackstageFrontpageHeaderMarkdown" />

    <BigEventCalendar />

    <SettingMarkdown setting="BackstageFrontpageMarkdown" />



    {/* <DashboardInner /> */}
  </Suspense>
  )
};

const Home: BlitzPage = () => {
  return (
    <DashboardLayout title="Home">
      <DynamicContent />
    </DashboardLayout>
  )
}

export default Home;
