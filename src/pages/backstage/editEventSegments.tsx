import { BlitzPage } from "@blitzjs/next";
import React from 'react';
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventTableClientColumns } from "src/core/components/EventComponentsBase";
import { EventSegmentClientColumns } from "src/core/components/EventSegmentComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";

// if you pass an eventId querystring param,
// it will act as the fixed value of the event column.
// so, that will affect
// viewing
//   there will always be a filter on that field.
//   pretty sure that means the table itself will need to understand these params.
// insert
//   creating all will need to have this field fixed.
// update
//   should behave as normal


const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);

    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegment,
        columns: [
            EventSegmentClientColumns.id,
            EventSegmentClientColumns.name,
            EventTableClientColumns.status, // ya
            EventSegmentClientColumns.dateRange,
            EventSegmentClientColumns.description,
            EventSegmentClientColumns.event,
        ],
    });

    return <>
        <SettingMarkdown setting="EditEventSegmentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventId }}
        />
    </>;
};


const EditEventSegmentsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Segments" basePermission={Permission.admin_events}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventSegmentsPage;
