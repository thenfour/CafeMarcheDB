
import { CMButton } from "@/src/core/components/CMCoreComponents2";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { useRouter } from "next/router";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SongClientColumns } from "src/core/components/song/SongComponents";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs }) => {
    const router = useRouter(); return <>
        <CMButton onClick={() => {
            void router.push({
                pathname: '/backstage/editSongCredits',
                query: { songId: gridArgs.row.publicId },
            });
        }}>Credits</CMButton>
    </>;
};


const MainContent = () => {
    const songTableSpec = DB3Client.defineTableClientSpec({
        view: db3.songEditorView,
        columns: {
            ...DB3Client.makeClientColumnSelection(
                SongClientColumns.publicId,
                SongClientColumns.name,
                SongClientColumns.aliases,
                //SongClientColumns.slug,
                SongClientColumns.description,
                SongClientColumns.startBPM,
                SongClientColumns.endBPM,
                SongClientColumns.introducedYear,
                SongClientColumns.lengthSeconds,
                SongClientColumns.tags,
                SongClientColumns.createdByUser,
                SongClientColumns.visiblePermission,
            ),

            isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
        },
    });

    return <>
        <SettingMarkdown setting="editSongs_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={songTableSpec}
            view={db3.songEditorView}
            renderExtraActions={(args) => <ExtraActions gridArgs={args} />}
        />
    </>;
};


const EditSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongsPage;
