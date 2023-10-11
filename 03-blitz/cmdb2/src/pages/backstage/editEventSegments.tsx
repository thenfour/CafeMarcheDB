import { BlitzPage, useParam, useParams } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
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
    if (!useAuthorization("EditEventSegmentsPage", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegment,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.DateTimeColumn({ columnName: "startsAt", cellWidth: 180 }),
            new DB3Client.DateTimeColumn({ columnName: "endsAt", cellWidth: 180 }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "event", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        ],
    });

    return <>
        <SettingMarkdown settingName="EditEventSegmentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
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
