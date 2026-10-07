import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const MainContent = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestedSongId = urlParams.get('songId');
    const songId = db3.xSong.isIdentity(requestedSongId)
        ? db3.xSong.parseIdentity(requestedSongId)
        : null;

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.songCreditEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            user: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.member",}),
            song: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.song",}),
            type: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.creditType", selectionView: db3.songCreditTypeEditorView }),
        },
    });

    return <>
        <LocalizedMarkdown setting="EditSongCreditsPage_markdown"></LocalizedMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.songCreditEditorView}
            tableParams={{ songId }}
        />
    </>;
};


const EditSongCreditsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Song credits">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongCreditsPage;
