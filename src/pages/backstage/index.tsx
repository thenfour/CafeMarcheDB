import type { BlitzPage } from "@blitzjs/next";
import React from "react";
import { Alert, Stack } from "@mui/material";
import { CMLink } from "src/core/components/CMLink";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { withMemberPresentation } from "src/core/components/user/bandMemberLinks";
import { useLocale } from "src/locale/components/useLocale";
import { Localized } from "src/setting/client/components/SettingMarkdown";
import { Permission } from "shared/permissions";
import { AppContextMarker } from "src/core/components/AppContext";
import { PermissionBoundary } from "src/core/components/CMCoreComponents";
import { WikiStandaloneControl } from "src/core/components/wiki/WikiStandaloneComponents";

export function HomeContent() {
  const dashboard = useDashboardContext();
  const locale = useLocale();
  const member = dashboard.currentMembership;
  const bandPublicId = dashboard.memberPresentation.bandPublicId;
  return <AppContextMarker name="backstage home"><Stack spacing={2}>
    {!dashboard.memberPresentation.bandPublicId && <Alert severity="info">{locale.getPlainString("dashboard.band.required")}</Alert>}
    {member && member.bandUserInstruments.length === 0 && <Alert severity="info">
      {locale.getPlainString("dashboard.instruments.missing")}{" "}
      <CMLink href={withMemberPresentation("/backstage/profile", dashboard.memberPresentation)}>{locale.getPlainString("dashboard.profile")}</CMLink>
    </Alert>}
    <div className="DashboardHeader"><Localized id="BackstageFrontpageHeaderMarkdown" /></div>
    {bandPublicId && dashboard.currentUser && <PermissionBoundary permission={Permission.view_wiki_pages}>
      <WikiStandaloneControl canonicalWikiPath="special/announcements"
        className="contentSection announcementMarkdown" floatingHeader={true} />
    </PermissionBoundary>}
    {bandPublicId && <PermissionBoundary permission={Permission.view_events_nonpublic}>
      <Alert severity="info">{locale.getPlainString("dashboard.eventsDeferred")}</Alert>
    </PermissionBoundary>}
    <Localized id="BackstageFrontpageMarkdown" />
  </Stack></AppContextMarker>;
}

const Home: BlitzPage = () => {
  const locale = useLocale();
  return <DashboardLayout title={locale.getPlainString("dashboard.title")}><HomeContent /></DashboardLayout>;
};

export default Home;


// MIGRATION_RESTORE: dashboard-content
// Source: 451c9cde3af65ffce804cb7360032dd001c681eb:src/pages/backstage/index.tsx:1-78
// Reason: Startup intentionally omits legacy domain readers and the home page hides their content.
// Restore: Restore relevant events, calendar, announcements/wiki content, custom navigation and required reference catalogs with authorized band-scoped reads.
// Verification: Adapt dashboard transport specifications and add native snapshots plus built-browser checks for two bands, permission revocation and context switches.
// SHA256: c8f34be3b66c191cd3fea5d84be20ed5f22af407dce89109cdc0d36ab2b2f331
// MIGRATION_REFERENCE_BEGIN
// import { RelevantEvents } from "@/src/core/components/event/RelevantEvents";
// import { BlitzPage } from "@blitzjs/next";
// import { Suspense } from "react";
// import { Permission } from "shared/permissions";
// import { AppContextMarker } from "src/core/components/AppContext";
// import { CMSinglePageSurfaceCard, PermissionBoundary } from "src/core/components/CMCoreComponents";
// import { BigEventCalendar } from "src/core/components/EventCalendar";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { WikiStandaloneControl } from "src/core/components/wiki/WikiStandaloneComponents";
// import { gIconMap } from "src/core/db3/components/IconMap";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
//
//
// const HomepageBigEventCalendar = () => {
//   const dashboardContext = useDashboardContext();
//   if (!dashboardContext) return null;
//   return <BigEventCalendar />;
//   //return <BigEventCalendar selectedEventId={dashboardContext.relevantEventIds[0]} />;
// };
//
// const DynamicContent = () => {
//   const dashboardContext = useDashboardContext();
//   const currentUser = dashboardContext.currentUser;
//   let noInstrumentsWarning = (currentUser?.instruments?.length || 0) < 1;
//   const userHasLimitedAccount = !!(currentUser?.role?.isRoleForNewUsers);
//   const userHasNoAccountButNoRole = !!(currentUser && !currentUser.role);
//   const limitedAccountWarning = userHasLimitedAccount || userHasNoAccountButNoRole;
//
//   return (<Suspense>
//     <AppContextMarker name="backstage home">
//
//       {limitedAccountWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
//         <div>{gIconMap.ErrorOutline()}</div>
//         <div>Your account has limited access; please contact an admin for access 😊.
//         </div>
//       </CMSinglePageSurfaceCard>}
//
//       {noInstrumentsWarning && <CMSinglePageSurfaceCard className="noInstrumentsWarning">
//         <div>{gIconMap.ErrorOutline()}</div>
//         <div>You have no instruments assigned; please go to
//           &nbsp;<a href="/backstage/profile">your profile</a>&nbsp;
//           and specify your instruments.
//         </div>
//       </CMSinglePageSurfaceCard>}
//
//       <div className="DashboardHeader">
//         <LocalizedMarkdown setting="BackstageFrontpageHeaderMarkdown" />
//       </div>
//
//       <WikiStandaloneControl
//         canonicalWikiPath="special/announcements"
//         className="contentSection announcementMarkdown"
//         floatingHeader={true}
//       />
//
//       <PermissionBoundary permission={Permission.view_events_nonpublic}>
//         <RelevantEvents />
//         <HomepageBigEventCalendar />
//       </PermissionBoundary>
//
//       <LocalizedMarkdown setting="BackstageFrontpageMarkdown" />
//
//     </AppContextMarker>
//     {/* <DashboardInner /> */}
//   </Suspense>
//   )
// };
//
// const Home: BlitzPage = () => {
//   return (
//     <DashboardLayout title="Home">
//       <DynamicContent />
//     </DashboardLayout>
//   )
// }
//
// export default Home;
// MIGRATION_REFERENCE_END
