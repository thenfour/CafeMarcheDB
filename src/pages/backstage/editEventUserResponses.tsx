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


const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);

    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventUserResponse,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "userComment", cellWidth: 200 }),
            new DB3Client.BoolColumnClient({ columnName: "isInvited" }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "eventId", cellWidth: 150 }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "instrument", cellWidth: 120, }),
        ],
    });

    return <>
        <SettingMarkdown setting="EventUserResponsePage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventId }}
        />
    </>;
};


const EventUserResponsePage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Responses" basePermission={Permission.admin_events}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EventUserResponsePage;
