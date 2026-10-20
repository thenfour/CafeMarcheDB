import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
// band dashboard.

import { defineCmdbPage } from "src/route/cmdbPage";

import { usePresentation } from "@/src/locale/components/PresentationProvider";
import { CMLink } from "@/src/route/CMLink";
import type { BlitzPage } from "@blitzjs/next";
import { Alert, Stack } from "@mui/material";
import React from "react";
import { AppContextMarker } from "src/core/components/AppContext";
import { PermissionBoundary } from "src/core/components/CMCoreComponents";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { RelevantEvents } from "src/core/components/event/RelevantEvents";
import { BigEventCalendar } from "src/core/components/EventCalendar";
import { WikiStandaloneControl } from "src/core/components/wiki/WikiStandaloneComponents";
import { useLocale } from "src/locale/components/useLocale";
import { useCmdbRouter } from "src/route/useCmdbRouter";
import { Localized } from "@/src/locale/components/Localized";

export function HomeContent() {
  const cmdbRouter = useCmdbRouter();
  const dashboard = useDashboardContext();
  const presentation = usePresentation();
  const bandName = presentation.data?.band?.name || "";
  const member = dashboard.currentMembership;
  const bandPublicId = dashboard.memberPresentation.bandPublicId;
  return <AppContextMarker name="backstage home"><Stack spacing={2}>

    {dashboard.currentUser && !dashboard.isAuthorized(BandPermission.member_access) && <Alert severity="info">
      <Localized id="dashboard.account.limited" />
    </Alert>}

    {!dashboard.memberPresentation.bandPublicId && <Alert severity="info"><Localized id="dashboard.band.required" /></Alert>}

    {member && member.bandUserInstruments.length === 0 && <Alert severity="info">
      <Localized id="dashboard.instruments.missing" />{" "}
      <CMLink href={cmdbRouter.href("/backstage/profile")}>
        <Localized id="menu.profile" parameters={{ bandName }} />
      </CMLink>
    </Alert>}

    <div className="DashboardHeader"><Localized id="BackstageFrontpageHeaderMarkdown" /></div>

    {bandPublicId && dashboard.currentUser && <PermissionBoundary permission={BandPermission.view_wiki_pages}>
      <WikiStandaloneControl canonicalWikiPath="special/announcements"
        className="contentSection announcementMarkdown" floatingHeader={true} />
    </PermissionBoundary>}

    {bandPublicId && <PermissionBoundary permission={BandPermission.view_events_nonpublic}>
      <React.Suspense fallback={<div className="lds-dual-ring" />}>
        <RelevantEvents />
        <BigEventCalendar />
      </React.Suspense>
    </PermissionBoundary>}
    <Localized id="BackstageFrontpageMarkdown" />
  </Stack></AppContextMarker>;
}

const Home: BlitzPage = () => {
  const locale = useLocale();
  return <DashboardLayout title={locale.getPlainString("dashboard.title")}>
    <HomeContent />
  </DashboardLayout>;
};

defineCmdbPage("bandRoot", Home);
export default Home;
