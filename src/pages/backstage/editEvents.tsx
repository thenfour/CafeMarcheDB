import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

export default function RecoveryPage_editEvents() {
    return <DeferredDomainPage feature="eventWorkflows" />;
}

// MIGRATION_RESTORE: event-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/editEvents.tsx:1-79
// Reason: Event screens still mount incomplete search, editing and invitation contracts.
// Restore: Restore event search/detail/editing, segments, invitations and frontpage editing through explicit band snapshots, public references and localized catalogs; retain migrated creation, attendance and calendar endpoints.
// Verification: Verify two-band search/facets/paging, event and segment edits, invitation precedence, visibility, revoked grants and complete built-browser workflows.
// SHA256: f24e66eda9b80f3116544c625df0ca6b850d7fcc97f91fb58ec54f667aaf7aba
// MIGRATION_REFERENCE_BEGIN
// import { CMButton } from "@/src/core/components/CMCoreComponents2";
// import { BlitzPage } from "@blitzjs/next";
// import DashboardLayout from "@components/dashboard/DashboardLayout";
// import { EventTableClientColumns } from "@components/event/EventComponentsBase";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "@db3/components/db3DataGrid";
// import * as db3 from "@db3/db3";
// import * as DB3Client from "@db3/DB3Client";
// import { useRouter } from "next/router";
//
// type EventEditorClient = db3.ClientOf<typeof db3.eventEditorView>;
//
// const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs<EventEditorClient> }) => {
//     const router = useRouter(); return <>
//         <CMButton onClick={() => {
//             void router.push({
//                 pathname: '/backstage/editEventSegments',
//                 query: { eventId: gridArgs.row.publicId },
//             });
//         }}>Segments</CMButton>
//         <CMButton onClick={() => {
//             void router.push({
//                 pathname: '/backstage/editEventSongLists',
//                 query: { eventId: gridArgs.row.publicId },
//             });
//         }}>Song lists</CMButton>
//     </>;
// };
//
// const MainContent = () => {
//     const tableSpec = DB3Client.defineTableClientSpec({
//         view: db3.eventEditorView,
//         columns: DB3Client.makeClientColumnSelection(
//             EventTableClientColumns.name,
//             EventTableClientColumns.startsAt,
//             //EventTableClientColumns.description,
//             EventTableClientColumns.isDeleted,
//             EventTableClientColumns.locationDescription,
//             EventTableClientColumns.locationURL,
//             EventTableClientColumns.createdAt,
//             EventTableClientColumns.type,
//             EventTableClientColumns.status,
//             EventTableClientColumns.tags,
//             EventTableClientColumns.expectedAttendanceUserTag,
//             EventTableClientColumns.createdByUser,
//             EventTableClientColumns.visiblePermission,
//             EventTableClientColumns.frontpageVisible,
//             EventTableClientColumns.frontpageDate,
//             EventTableClientColumns.frontpageTime,
//             EventTableClientColumns.frontpageDetails,
//             EventTableClientColumns.frontpageTitle,
//             EventTableClientColumns.frontpageLocation,
//             EventTableClientColumns.frontpageLocationURI,
//             EventTableClientColumns.frontpageTags,
//         ),
//     });
//
//     return <>
//         <LocalizedMarkdown setting="editEvents_markdown"></LocalizedMarkdown>
//         <DB3EditGrid
//             tableSpec={tableSpec}
//             view={db3.eventEditorView}
//             renderExtraActions={(args) => {
//                 return <ExtraActions gridArgs={args} />
//             }}
//         />
//     </>;
// };
//
//
// const EditEventsPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Events">
//             <MainContent />
//         </DashboardLayout>
//     )
// }
//
// export default EditEventsPage;
// MIGRATION_REFERENCE_END
