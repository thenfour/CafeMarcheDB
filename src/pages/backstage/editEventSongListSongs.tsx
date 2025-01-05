import { BlitzPage } from "@blitzjs/next";
import React from 'react';
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xEventSongListSong,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "subtitle", cellWidth: 180 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 100 }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "song", cellWidth: 120, }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "eventSongList", cellWidth: 120, }),
    ],
});



const MainContent = () => {

    const dashboardContext = React.useContext(DashboardContext);

    const urlParams = new URLSearchParams(window.location.search);
    const eventSongListId: number | null = parseIntOrNull(urlParams.get('eventSongListId'));
    return <>
        <SettingMarkdown setting="EditEventSongListSongsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventSongListId }}
        />
    </>;
};


const EditEventSongListSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Song List Entries" basePermission={Permission.admin_events}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventSongListSongsPage;
