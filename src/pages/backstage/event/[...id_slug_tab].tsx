import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

export default function RecoveryPage() {
    return <DeferredDomainPage feature="eventWorkflows" />;
}

// MIGRATION_RESTORE: event-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/event/[...id_slug_tab].tsx:1-162
// Reason: Event screens still mount incomplete search, editing and invitation contracts.
// Restore: Restore event search/detail/editing, segments, invitations and frontpage editing through explicit band snapshots, public references and localized catalogs; retain migrated creation, attendance and calendar endpoints.
// Verification: Verify two-band search/facets/paging, event and segment edits, invitation precedence, visibility, revoked grants and complete built-browser workflows.
// SHA256: 3dff6df0238a63e02ae201a4ddb2ba62cfda6c5b8645baefde4f5fa5146782a8
// MIGRATION_REFERENCE_BEGIN
// import { loadAuthorizedPageEntity } from "@/src/auth/server/serverPageAuthorization";
// import { gSSP } from "@/src/blitz-server";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
// import { useDashboardContext, useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";
// import { NewEventButton } from "@/src/core/components/event/NewEventComponents";
// import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
// import { BlitzPage, useParams } from "@blitzjs/next";
// import db from "db";
// import React, { Suspense } from 'react';
// import { toSorted } from "shared/arrayUtils";
// import { Permission } from "shared/permissions";
// import type { EventPublicId } from "shared/publicId";
// import { AppContextMarker } from "src/core/components/AppContext";
// import { EventBreadcrumbs, EventDetailFull, gEventDetailTabSlugIndices } from "src/core/components/event/EventComponents";
// import { EventTableClientColumns } from "src/core/components/event/EventComponentsBase";
// import * as DB3Client from "src/core/db3/DB3Client";
// import * as db3 from "src/core/db3/db3";
//
// const MyComponent = ({ eventId }: { eventId: null | EventPublicId }) => {
//     const params = useParams();
//     const [id__, slug, tab] = params.id_slug_tab as string[];
//     const dashboardContext = useDashboardContext();
//
//     //if (!idOrSlug) return <div>no event specified</div>;
//     if (!eventId) throw new Error(`event not found`);
//
//     useRecordFeatureUse({ feature: ActivityFeature.event_view, eventId });
//
//
//
//     const tableClient = DB3Client.useTableRenderContext({
//         requestedCaps: DB3Client.xTableClientCaps.Query,
//         tableSpec: DB3Client.defineTableClientSpec({
//             view: db3.eventDetailView,
//             columns: DB3Client.makeClientColumnSelection(
//                 EventTableClientColumns.name,
//                 EventTableClientColumns.locationDescription,
//                 EventTableClientColumns.type,
//                 EventTableClientColumns.status,
//                 EventTableClientColumns.tags,
//                 EventTableClientColumns.expectedAttendanceUserTag,
//                 EventTableClientColumns.visiblePermission,
//             ),
//         }),
//         filterModel: {
//             tableParams: { eventId },
//         },
//         referenceProvider: dashboardContext.referenceStore,
//     });
//
//     let initialTabIndex: string = "";
//     if (!!tab && gEventDetailTabSlugIndices[tab]) {
//         initialTabIndex = gEventDetailTabSlugIndices[tab];
//     }
//
//     const event = tableClient.items[0] ?? null;
//
//     const refetch = () => {
//         tableClient.refetch();
//     };
//
//     return <div className="eventDetailComponent">
//         <NewEventButton />
//         {event ? <>
//             <EventBreadcrumbs event={event} />
//             <EventDetailFull
//                 readonly={false}
//                 event={event}
//                 tableClient={tableClient}
//                 initialTabIndex={initialTabIndex}
//                 refetch={refetch}
//             />
//         </> : <>
//             no event was found. some possibilities:
//             <ul>
//                 <li>the event was deleted or you don't have permission to view it</li>
//                 <li>the event's slug (title) or ID changed.</li>
//             </ul>
//         </>}
//     </div>;
// };
//
//
//
// interface PageProps {
//     title: string,
//     eventId: EventPublicId | null,
// };
//
// export const getServerSideProps = gSSP<PageProps>(async ({ params, req, ctx }) => {
//     const [id__] = params!.id_slug_tab as string[];
//     if (!db3.xEvent.isIdentity(id__)) return { notFound: true };
//     const publicId = db3.xEvent.parseIdentity(id__);
//
//     const event = await loadAuthorizedPageEntity({
//         ctx,
//         permission: Permission.view_events_nonpublic,
//         table: db3.xEvent,
//         identity: publicId,
//         load: where => db.event.findFirst({
//             select: {
//                 publicId: true,
//                 name: true,
//                 startsAt: true,
//                 segments: {
//                     select: {
//                         startsAt: true,
//                         statusId: true,
//                     }
//                 }
//             },
//             where,
//         }),
//     });
//     if (!event) return { notFound: true };
//
//     // persisted status is valid even if it's isDeleted=true.
//     const statuses = await db.eventStatus.findMany();
//     const cancelledStatusIds = db3.getCancelledStatusIds(statuses, status => status.id);
//     const isCancelled = (statusId: number | null) => {
//         if (!statusId) return false;
//         return cancelledStatusIds.includes(statusId);
//     }
//
//     // Format the date using the user's locale
//     const acceptLanguage = req.headers['accept-language'] || 'en-US'; // Default to 'en-US' if not specified
//     const locale = acceptLanguage.split(',')[0]; // Get the first preferred language
//     const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
//
//     // skip cancelled segments
//     const validSegmentsSorted = toSorted(
//         event.segments
//             .filter(s => !isCancelled(s.statusId)),
//         (a, b) => db3.compareEventSegments(a, b, cancelledStatusIds));
//     let title = event.name;
//     if (validSegmentsSorted.length) {
//         const seg = validSegmentsSorted[0]!;
//         const formattedDate = seg.startsAt ? seg.startsAt.toLocaleDateString(locale, options) : "TBD";
//         title = `${event.name} | ${formattedDate}`;
//     }
//
//     return { props: { title, eventId: db3.xEvent.parseIdentity(event.publicId) } };
// });
//
//
//
// const EventDetailPage: BlitzPage = (props: PageProps) => {
//     return (
//         <DashboardLayout title={props.title} navRealm={NavRealm.events}>
//             <AppContextMarker name="event page" eventId={props.eventId || undefined}>
//                 <Suspense>
//                     <MyComponent eventId={props.eventId}></MyComponent>
//                 </Suspense>
//                 {/* this helps prevent annoying scroll behavior when switching tabs */}
//                 <div style={{ height: "65vh" }}></div>
//             </AppContextMarker>
//         </DashboardLayout>
//     )
// }
//
// export default EventDetailPage;
// MIGRATION_REFERENCE_END
