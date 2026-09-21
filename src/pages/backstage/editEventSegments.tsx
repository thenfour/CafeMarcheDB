import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { parseIntOrNull } from "shared/utils";
import { EventTableClientColumns } from "src/core/components/event/EventComponentsBase";
import { EventSegmentClientColumns } from "src/core/components/event/EventSegmentComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

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
    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));

    const tableSpec = DB3Client.defineLegacyTableClientSpec({
        table: db3.xEventSegment,
        columns: DB3Client.makeClientColumnSelection(
            EventSegmentClientColumns.id,
            EventSegmentClientColumns.name,
            EventTableClientColumns.status, // ya
            EventSegmentClientColumns.startsAt,
            EventSegmentClientColumns.description,
            EventSegmentClientColumns.event,
        ),
    });

    return <>
        <SettingMarkdown setting="EditEventSegmentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.eventSegmentEditorView}
            tableParams={{ eventId }}
        />
    </>;
};


const EditEventSegmentsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Segments">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventSegmentsPage;
