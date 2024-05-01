import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React from 'react';
import { DashboardContext } from "src/core/components/DashboardContext";


const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);
    if (!dashboardContext.isAuthorized(Permission.admin_events)) {
        throw new Error(`unauthorized`);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const eventSegmentId: number | null = parseIntOrNull(urlParams.get('eventSegmentId'));

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegmentUserResponse,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            //new DB3Client.MarkdownStringColumnClient({ columnName: "attendanceComment", cellWidth: 200 }),
            //new DB3Client.BoolColumnClient({ columnName: "expectAttendance" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "eventSegment", cellWidth: 120, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "attendance", cellWidth: 120, }),
            //new DB3Client.ForeignSingleFieldClient({ columnName: "instrument", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        ],
    });

    return <>
        <SettingMarkdown setting="EventSegmentUserResponsePage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventSegmentId }}
        />
    </>;
};


const EventSegmentUserResponsePage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Segment Responses">
            <MainContent />
        </DashboardLayout>
    )
}

export default EventSegmentUserResponsePage;
