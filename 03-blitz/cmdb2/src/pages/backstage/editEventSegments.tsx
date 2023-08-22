import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xEventSegment,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.DateTimeColumn({ columnName: "startsAt", cellWidth: 180 }),
        new DB3Client.DateTimeColumn({ columnName: "endsAt", cellWidth: 180 }),
        new DB3Client.ForeignSingleFieldClient({ columnName: "event", cellWidth: 120 }),
    ],
});


// new ForeignSingleField<Prisma.EventGetPayload<{}>>({
//     columnName: "event",
//     fkMember: "eventId",
//     allowNull: false,
//     foreignTableSpec: xEvent,
//     getQuickFilterWhereClause: (query: string) => false,
// }),



const MainContent = () => {
    if (!useAuthorization("EditEventSegmentsPage", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="EditEventSegmentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
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
