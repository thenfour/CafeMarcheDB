import React from "react";
import { DeferredDomainPage } from "src/core/components/DeferredDomainPage";

export default function RecoveryPage() {
    return <DeferredDomainPage feature="songWorkflows" />;
}

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/editSongs.tsx:1-67
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: c86ba606e736d8c1c27898898c676e6c3027c5960e36c0145f8acd9329c17696
// MIGRATION_REFERENCE_BEGIN
//
// import { CMButton } from "@/src/core/components/CMCoreComponents2";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { BlitzPage } from "@blitzjs/next";
// import { useRouter } from "next/router";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { SongClientColumns } from "src/core/components/song/SongComponents";
// import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
// import * as db3 from "src/core/db3/db3";
// import * as DB3Client from "src/core/db3/DB3Client";
//
//
// const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs }) => {
//     const router = useRouter(); return <>
//         <CMButton onClick={() => {
//             void router.push({
//                 pathname: '/backstage/editSongCredits',
//                 query: { songId: gridArgs.row.publicId },
//             });
//         }}>Credits</CMButton>
//     </>;
// };
//
//
// const MainContent = () => {
//     const songTableSpec = DB3Client.defineTableClientSpec({
//         view: db3.songEditorView,
//         columns: {
//             ...DB3Client.makeClientColumnSelection(
//                 SongClientColumns.publicId,
//                 SongClientColumns.name,
//                 SongClientColumns.aliases,
//                 //SongClientColumns.slug,
//                 SongClientColumns.description,
//                 SongClientColumns.startBPM,
//                 SongClientColumns.endBPM,
//                 SongClientColumns.introducedYear,
//                 SongClientColumns.lengthSeconds,
//                 SongClientColumns.tags,
//                 SongClientColumns.createdByUser,
//                 SongClientColumns.visiblePermission,
//             ),
//
//             isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
//         },
//     });
//
//     return <>
//         <LocalizedMarkdown setting="editSongs_markdown"></LocalizedMarkdown>
//         <DB3EditGrid
//             tableSpec={songTableSpec}
//             view={db3.songEditorView}
//             renderExtraActions={(args) => <ExtraActions gridArgs={args} />}
//         />
//     </>;
// };
//
//
// const EditSongsPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Songs">
//             <MainContent />
//         </DashboardLayout>
//     )
// }
//
// export default EditSongsPage;
// MIGRATION_REFERENCE_END
