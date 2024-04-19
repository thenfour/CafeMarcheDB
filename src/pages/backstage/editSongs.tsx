
import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import { useRouter } from "next/router";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
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
            void router.push({
                pathname: '/backstage/editSongCredits',
                query: { songId: gridArgs.row.id },
            });
        }}>Credits</Button>
    </>;
};


const MainContent = () => {
    if (!useAuthorization("admin songs page", Permission.admin_songs)) {
        throw new Error(`unauthorized`);
    }

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


            // new DB3Client.PKColumnClient({ columnName: "id" }),
            // new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
            // new DB3Client.SlugColumnClient({ columnName: "slug", cellWidth: 120 }),
            // new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            // new DB3Client.GenericIntegerColumnClient({ columnName: "startBPM", cellWidth: 100 }),
            // new DB3Client.GenericIntegerColumnClient({ columnName: "endBPM", cellWidth: 100 }),
            // new DB3Client.GenericIntegerColumnClient({ columnName: "introducedYear", cellWidth: 100 }),
            // new DB3Client.GenericIntegerColumnClient({ columnName: "lengthSeconds", cellWidth: 100 }),
            // new DB3Client.TagsFieldClient({ columnName: "tags", cellWidth: 200, allowDeleteFromCell: false }),
            // new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, }),
            // new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, }),
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
        <DashboardLayout title="Songs">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongsPage;
