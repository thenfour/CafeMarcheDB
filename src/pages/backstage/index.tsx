import { RelevantEvents } from "@/src/core/components/event/RelevantEvents";
import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMSinglePageSurfaceCard, PermissionBoundary } from "src/core/components/CMCoreComponents";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { BigEventCalendar } from "src/core/components/EventCalendar";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { WikiStandaloneControl } from "src/core/components/wiki/WikiStandaloneComponents";
import { gIconMap } from "src/core/db3/components/IconMap";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const HomepageBigEventCalendar = () => {
  const dashboardContext = useDashboardContext();
  if (!dashboardContext) return null;
  return <BigEventCalendar />;
  //return <BigEventCalendar selectedEventId={dashboardContext.relevantEventIds[0]} />;
};

const DynamicContent = () => {
  const dashboardContext = useDashboardContext();
  const currentUser = dashboardContext.currentUser;
  let noInstrumentsWarning = (currentUser?.instruments?.length || 0) < 1;
  let limitedAccountWarning = !!(currentUser?.role?.isRoleForNewUsers);

  return (<Suspense>
    <AppContextMarker name="backstage home">

      {limitedAccountWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
        <div>{gIconMap.ErrorOutline()}</div>
        <div>Your account has limited access; please contact a site admin to grant you access 😊.
        </div>
      </CMSinglePageSurfaceCard>}

      {noInstrumentsWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
        <div>{gIconMap.ErrorOutline()}</div>
        <div>You have no instruments assigned; please go to
          &nbsp;<a href="/backstage/profile">your profile</a>&nbsp;
          and specify your instruments.
        </div>
      </CMSinglePageSurfaceCard>}

      <div className="DashboardHeader">
        <SettingMarkdown setting="BackstageFrontpageHeaderMarkdown" />
      </div>

      <WikiStandaloneControl
        canonicalWikiPath="special/announcements"
        className="contentSection announcementMarkdown"
        floatingHeader={true}
      />

      <PermissionBoundary permission={Permission.view_events_nonpublic}>
        <RelevantEvents />
        <HomepageBigEventCalendar />
      </PermissionBoundary>

      <SettingMarkdown setting="BackstageFrontpageMarkdown" />

    </AppContextMarker>
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
