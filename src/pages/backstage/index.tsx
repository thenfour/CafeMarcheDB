import { useCmdbRouter } from "src/route/useCmdbRouter";
import type { BlitzPage } from "@blitzjs/next";
import React from "react";
import { Alert, Stack } from "@mui/material";
import { CMLink } from "@/src/route/CMLink";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { useLocale } from "src/locale/components/useLocale";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";
import { Permission } from "shared/permissions";
import { AppContextMarker } from "src/core/components/AppContext";
import { PermissionBoundary } from "src/core/components/CMCoreComponents";
import { WikiStandaloneControl } from "src/core/components/wiki/WikiStandaloneComponents";
import { RelevantEvents } from "src/core/components/event/RelevantEvents";
import { BigEventCalendar } from "src/core/components/EventCalendar";

export function HomeContent() {
    const cmdbRouter = useCmdbRouter();
  const dashboard = useDashboardContext();
  const locale = useLocale();
  const member = dashboard.currentMembership;
  const bandPublicId = dashboard.memberPresentation.bandPublicId;
  return <AppContextMarker name="backstage home"><Stack spacing={2}>
    {dashboard.currentUser && dashboard.hasLimitedAccess && <Alert severity="info">
      {locale.getPlainString("dashboard.account.limited")}
    </Alert>}
    {!dashboard.memberPresentation.bandPublicId && <Alert severity="info">{locale.getPlainString("dashboard.band.required")}</Alert>}
    {member && member.bandUserInstruments.length === 0 && <Alert severity="info">
      {locale.getPlainString("dashboard.instruments.missing")}{" "}
      <CMLink href={cmdbRouter.href("/backstage/profile")}>{locale.getPlainString("dashboard.profile")}</CMLink>
    </Alert>}
    <div className="DashboardHeader"><BandLocalizedMarkdown id="BackstageFrontpageHeaderMarkdown" /></div>
    {bandPublicId && dashboard.currentUser && <PermissionBoundary permission={Permission.view_wiki_pages}>
      <WikiStandaloneControl canonicalWikiPath="special/announcements"
        className="contentSection announcementMarkdown" floatingHeader={true} />
    </PermissionBoundary>}
    {bandPublicId && <PermissionBoundary permission={Permission.view_events_nonpublic}>
      <React.Suspense fallback={<div className="lds-dual-ring" />}>
        <RelevantEvents />
        <BigEventCalendar />
      </React.Suspense>
    </PermissionBoundary>}
    <BandLocalizedMarkdown id="BackstageFrontpageMarkdown" />
  </Stack></AppContextMarker>;
}

const Home: BlitzPage = () => {
  const locale = useLocale();
  return <DashboardLayout title={locale.getPlainString("dashboard.title")}>
    <HomeContent />
  </DashboardLayout>;
};

export default Home;
