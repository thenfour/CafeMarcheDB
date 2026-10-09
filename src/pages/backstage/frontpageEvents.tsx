import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

export default function RecoveryPage_frontpageEvents() {
    return <DeferredDomainPage feature="eventWorkflows" />;
}

// MIGRATION_RESTORE: event-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/frontpageEvents.tsx:1-130
// Reason: Event screens still mount incomplete search, editing and invitation contracts.
// Restore: Restore event search/detail/editing, segments, invitations and frontpage editing through explicit band snapshots, public references and localized catalogs; retain migrated creation, attendance and calendar endpoints.
// Verification: Verify two-band search/facets/paging, event and segment edits, invitation precedence, visibility, revoked grants and complete built-browser workflows.
// SHA256: b1be8be44f78adc2f0a81b0006995896c7f679c3cee92dd822bed33eedcf4678
// MIGRATION_REFERENCE_BEGIN
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
// import { sortEvents } from "@/src/core/db3/shared/apiTypes";
// import { BlitzPage } from "@blitzjs/next";
// import { Suspense } from 'react';
// import type { DateTimeRange } from "shared/time";
// import { gQueryOptions } from "shared/utils";
// import { AppContextMarker } from "src/core/components/AppContext";
// import { EventSearchItemContainer } from "src/core/components/event/EventComponents";
// import { EventFrontpageTabContent } from "src/core/components/event/EventFrontpageComponents";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import * as db3 from "src/core/db3/db3";
// import * as DB3Client from "src/core/db3/DB3Client";
//
// // same thing but has a valid daterange
// type ReadyEventFrontpageClient = db3.EventFrontpageClient & {
//     dateRange: DateTimeRange;
// };
//
// const isEventFrontpageReady = (
//     event: db3.EventFrontpageClient,
// ): event is ReadyEventFrontpageClient => (
//     event.startsAt !== undefined
//     && event.name !== undefined
//     // && event.locationDescription !== undefined
//     // && event.tags !== undefined
//     && event.frontpageVisible !== undefined
//     // && event.frontpageDate !== undefined
//     // && event.frontpageTime !== undefined
//     // && event.frontpageDetails !== undefined
//     // && event.frontpageTitle !== undefined
//     // && event.frontpageLocation !== undefined
//     // && event.frontpageLocationURI !== undefined
//     // && event.frontpageTags !== undefined
//     // && event.frontpageDate_nl !== undefined
//     // && event.frontpageTime_nl !== undefined
//     // && event.frontpageDetails_nl !== undefined
//     // && event.frontpageTitle_nl !== undefined
//     // && event.frontpageLocation_nl !== undefined
//     // && event.frontpageLocationURI_nl !== undefined
//     // && event.frontpageTags_nl !== undefined
//     // && event.frontpageDate_fr !== undefined
//     // && event.frontpageTime_fr !== undefined
//     // && event.frontpageDetails_fr !== undefined
//     // && event.frontpageTitle_fr !== undefined
//     // && event.frontpageLocation_fr !== undefined
//     // && event.frontpageLocationURI_fr !== undefined
//     // && event.frontpageTags_fr !== undefined
// );
//
// const EventsList = () => {
//
//     const dashboardContext = useDashboardContext();
//
//
//     const tableParams: db3.EventTableParams = {
//         forFrontPageAgenda: true,
//     };
//
//     const eventsClient = DB3Client.useTableRenderContext({
//         tableSpec: DB3Client.defineTableClientSpec({
//             view: db3.eventFrontpageView,
//             columns: {},
//         }),
//         filterModel: {
//             tableParams,
//         },
//         paginationModel: {
//             page: 0,
//             pageSize: 20,
//         },
//         requestedCaps: DB3Client.xTableClientCaps.Query,
//         queryOptions: gQueryOptions.liveData,
//         referenceProvider: dashboardContext.referenceStore,
//     });
//
//     const readyEvents = eventsClient.items.filter(isEventFrontpageReady);
//     const events = sortEvents(readyEvents.map(event => ({
//         event,
//         startsAt: event.dateRange.getSpec().startsAtDateTime,
//     }))).map(item => item.event);
//
//     const refetch = eventsClient.refetch;
//
//     return <>{events.length < 1 ? "Nothing here!" : <>
//         {events.map(event => {
//             return <EventSearchItemContainer
//                 key={event.publicId}
//                 event={event}
//                 fadePastEvents={false}
//                 hideTagsWhenCancelled={false}
//                 showVisibility
//                 refetch={refetch}
//             >
//                 <EventFrontpageTabContent
//                     readonly={false}
//                     refetch={refetch}
//                     event={event}
//                     dateRange={event.dateRange}
//                 />
//             </EventSearchItemContainer>;
//         }
//         )}
//     </>}
//     </>;
// };
//
// const MainContent = () => {
//     return <div>
//         <Suspense>
//             <LocalizedMarkdown setting="FrontpageAgendaPage_markdown"></LocalizedMarkdown>
//         </Suspense>
//
//         <Suspense>
//             <EventsList />
//         </Suspense>
//     </div>;
// };
//
// const FrontpageAgendaPage: BlitzPage = (props) => {
//     return (
//         <DashboardLayout title="Homepage Agenda">
//             <AppContextMarker name="FrontpageAgendaPage">
//                 <MainContent />
//             </AppContextMarker>
//         </DashboardLayout>
//     )
// }
//
// export default FrontpageAgendaPage;
// MIGRATION_REFERENCE_END
