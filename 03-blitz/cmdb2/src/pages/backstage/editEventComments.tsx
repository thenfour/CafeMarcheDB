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
    table: db3.xEventComment,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "text", cellWidth: 200 }),
        new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 180 }),
        new DB3Client.DateTimeColumn({ columnName: "updatedAt", cellWidth: 180 }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "event", cellWidth: 120, clientIntention: { intention: "admin" } }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, clientIntention: { intention: "admin" } }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, clientIntention: { intention: "admin" } }),
    ],
});

const MainContent = () => {
    if (!useAuthorization("EditEventCommentsPage", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const eventId: number | null = parseIntOrNull(urlParams.get('eventId'));
    return <>
        <SettingMarkdown settingName="EditEventCommentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            tableParams={{ eventId }}
        />
    </>;
};


const EditEventCommentsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Comments">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventCommentsPage;
