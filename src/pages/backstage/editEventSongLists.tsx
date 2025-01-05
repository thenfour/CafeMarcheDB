import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import { useRouter } from "next/router";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { simulateLinkClick } from "src/core/components/CMCoreComponents2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xEventSongList,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new DB3Client.BoolColumnClient({ columnName: "isOrdered" }),
        new DB3Client.BoolColumnClient({ columnName: "isActuallyPlayed" }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "event", cellWidth: 180 }),
    ],
});


const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs }) => {
    const router = useRouter();
    return <>
        <Button onClick={() => {
            simulateLinkClick({
                pathname: '/backstage/editEventSongListSongs',
                query: { eventSongListId: gridArgs.row.id },
            });
        }}>Songs...</Button>
    </>;
};


const MainContent = () => {


    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));
    return <>
        <SettingMarkdown setting="EditEventSongListsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventId }}
            renderExtraActions={(args) => <ExtraActions gridArgs={args} />}
        />
    </>;
};


const EditEventSongListsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Song Lists" basePermission={Permission.admin_events}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventSongListsPage;
