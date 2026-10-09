import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

export default function RecoveryPage_editEventSegments() {
    return <DeferredDomainPage feature="eventWorkflows" />;
}

// MIGRATION_RESTORE: event-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/editEventSegments.tsx:1-59
// Reason: Event screens still mount incomplete search, editing and invitation contracts.
// Restore: Restore event search/detail/editing, segments, invitations and frontpage editing through explicit band snapshots, public references and localized catalogs; retain migrated creation, attendance and calendar endpoints.
// Verification: Verify two-band search/facets/paging, event and segment edits, invitation precedence, visibility, revoked grants and complete built-browser workflows.
// SHA256: 803a9808c76fe2059ee29f58cc222b49c796a29a14ae12f2a195b97410712674
// MIGRATION_REFERENCE_BEGIN
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { BlitzPage } from "@blitzjs/next";
// import { EventTableClientColumns } from "src/core/components/event/EventComponentsBase";
// import { EventSegmentClientColumns } from "src/core/components/event/EventSegmentComponents";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
// import * as db3 from "src/core/db3/db3";
// import * as DB3Client from "src/core/db3/DB3Client";
//
// // if you pass an eventId querystring param,
// // it will act as the fixed value of the event column.
// // so, that will affect
// // viewing
// //   there will always be a filter on that field.
// //   pretty sure that means the table itself will need to understand these params.
// // insert
// //   creating all will need to have this field fixed.
// // update
// //   should behave as normal
//
//
// const MainContent = () => {
//     const urlParams = new URLSearchParams(window.location.search);
//     const eventIdParam = urlParams.get('eventId');
//     const eventId = eventIdParam && db3.xEvent.isIdentity(eventIdParam)
//         ? db3.xEvent.parseIdentity(eventIdParam)
//         : null;
//
//     const tableSpec = DB3Client.defineTableClientSpec({
//         view: db3.eventSegmentEditorView,
//         columns: DB3Client.makeClientColumnSelection(
//             EventSegmentClientColumns.name,
//             EventTableClientColumns.status, // ya
//             EventSegmentClientColumns.startsAt,
//             EventSegmentClientColumns.description,
//             EventSegmentClientColumns.event,
//         ),
//     });
//
//     return <>
//         <LocalizedMarkdown setting="EditEventSegmentsPage_markdown"></LocalizedMarkdown>
//         <DB3EditGrid
//             tableSpec={tableSpec}
//             view={db3.eventSegmentEditorView}
//             tableParams={{ eventId }}
//         />
//     </>;
// };
//
//
// const EditEventSegmentsPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Event Segments">
//             <MainContent />
//         </DashboardLayout>
//     )
// }
//
// export default EditEventSegmentsPage;
// MIGRATION_REFERENCE_END
