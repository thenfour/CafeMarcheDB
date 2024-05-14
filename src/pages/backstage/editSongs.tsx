
import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import { useRouter } from "next/router";
import { Permission } from "shared/permissions";
import { simulateLinkClick } from "src/core/components/CMCoreComponents2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SongClientColumns } from "src/core/components/SongComponents";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs }) => {
    const router = useRouter();
    return <>
        <Button onClick={() => {
            simulateLinkClick({
                pathname: '/backstage/editSongCredits',
                query: { songId: gridArgs.row.id },
            });
        }}>Credits</Button>
    </>;
};


const MainContent = () => {
    const songTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xSong,
        columns: [
            SongClientColumns.id,
            SongClientColumns.name,
            SongClientColumns.aliases,
            SongClientColumns.slug,
            SongClientColumns.description,
            SongClientColumns.startBPM,
            SongClientColumns.endBPM,
            SongClientColumns.introducedYear,
            SongClientColumns.lengthSeconds,
            SongClientColumns.tags,
            SongClientColumns.createdByUser,
            SongClientColumns.visiblePermission,

            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
        ],
    });

    return <>
        <SettingMarkdown setting="editSongs_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={songTableSpec}
            renderExtraActions={(args) => <ExtraActions gridArgs={args} />}
        />
    </>;
};


const EditSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs" basePermission={Permission.admin_songs}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongsPage;
