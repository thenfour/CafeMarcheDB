import React from "react";
import { Alert } from "@mui/material";
import { useRouter } from "next/router";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { Localized } from "src/setting/client/components/SettingMarkdown";
import { useLocale } from "src/locale/components/useLocale";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";

const MainContent = () => {
    const router = useRouter();
    const locale = useLocale();
    const requestedSongId = router.query.songId;
    const songId = requestedSongId === undefined ? null : db3.xSong.identitySchema.safeParse(requestedSongId);
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.songCreditEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            user: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.member", selectionView: db3.bandPersonReferenceView }),
            song: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.song", selectionView: db3.songReferenceView }),
            type: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.creditType", selectionView: db3.songCreditTypeEditorView, selectStyleSettingKey: "global.ui.songCredit.type.selectStyle" }),
            year: columnName => new DB3Client.GenericStringColumnClient({ columnName, fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.year" }),
            comment: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.comment" }),
        },
    });
    if (songId && !songId.success) {
        return <Alert severity="error">{locale.getPlainString("songCredits.invalidSong")}</Alert>;
    }
    return <>
        <Localized id="EditSongCreditsPage_markdown" />
        <DB3EditGrid tableSpec={tableSpec} view={db3.songCreditEditorView} tableParams={{ songId: songId?.data ?? null }} />
    </>;
};

const EditSongCreditsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("songCredits.title")}><MainContent /></DashboardLayout>;
};
export default EditSongCreditsPage;

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/pages/backstage/editSongCredits.tsx:1-45
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: 0eb20434a59da009e3e2774b97a9db4f759c2ed06d44c53cb9725ed5aea6ab8c
// MIGRATION_REFERENCE_BEGIN
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { BlitzPage } from "@blitzjs/next";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
// import * as db3 from "src/core/db3/db3";
// import * as DB3Client from "src/core/db3/DB3Client";
//
//
// const MainContent = () => {
//     const urlParams = new URLSearchParams(window.location.search);
//     const requestedSongId = urlParams.get('songId');
//     const songId = db3.xSong.isIdentity(requestedSongId)
//         ? db3.xSong.parseIdentity(requestedSongId)
//         : null;
//
//     const tableSpec = DB3Client.defineTableClientSpec({
//         view: db3.songCreditEditorView,
//         columns: {
//             publicId: DB3Client.publicIdFieldGen(),
//             user: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.member",}),
//             song: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.song",}),
//             type: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.creditType", selectionView: db3.songCreditTypeEditorView }),
//         },
//     });
//
//     return <>
//         <LocalizedMarkdown setting="EditSongCreditsPage_markdown"></LocalizedMarkdown>
//         <DB3EditGrid
//             tableSpec={tableSpec}
//             view={db3.songCreditEditorView}
//             tableParams={{ songId }}
//         />
//     </>;
// };
//
//
// const EditSongCreditsPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Song credits">
//             <MainContent />
//         </DashboardLayout>
//     )
// }
//
// export default EditSongCreditsPage;
// MIGRATION_REFERENCE_END
