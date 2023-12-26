import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xEventUserResponse,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "userComment", cellWidth: 200 }),
        new DB3Client.BoolColumnClient({ columnName: "isInvited" }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "eventId", cellWidth: 150 }),
        //new DB3Client.ForeignSingleFieldClient({ columnName: "eventSegment", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        //new DB3Client.ForeignSingleFieldClient({ columnName: "attendance", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "instrument", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
    ],
});

const MainContent = () => {
    if (!useAuthorization("EventUserResponsePage", Permission.admin_events)) {
        throw new Error(`unauthorized`);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));
    return <>
        <SettingMarkdown settingName="EventUserResponsePage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventId }}
        />
    </>;
};


const EventUserResponsePage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Responses">
            <MainContent />
        </DashboardLayout>
    )
}

export default EventUserResponsePage;
