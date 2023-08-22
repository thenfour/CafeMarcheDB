import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xEvent,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
        new DB3Client.GenericStringColumnClient({ columnName: "slug", cellWidth: 180 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        //new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
        //new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        //new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 120 }),
        new DB3Client.BoolColumnClient({ columnName: "isPublished" }),
        new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
        new DB3Client.BoolColumnClient({ columnName: "isCancelled" }),
        new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 180 }),
        new DB3Client.GenericStringColumnClient({ columnName: "locationURL", cellWidth: 180 }),
        new DB3Client.DateTimeColumn({ columnName: "cancelledAt", cellWidth: 180 }),
        new DB3Client.DateTimeColumn({ columnName: "createdAt", cellWidth: 180 }),
        new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 180 }),
        new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 180 }),
        new DB3Client.TagsFieldClient<db3.EventTagAssignmentModel>({ columnName: "tags", cellWidth: 220 }),
    ],
});


const MainContent = () => {
    if (!useAuthorization("EditEventsPage", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="editEvents_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};


const EditEventsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Events">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventsPage;
