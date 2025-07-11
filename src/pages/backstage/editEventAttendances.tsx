import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";



const MainContent = () => {
    //const dashboardContext = React.useContext(DashboardContext);

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventAttendance,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "text", cellWidth: 180 }),
            new DB3Client.GenericStringColumnClient({ columnName: "personalText", cellWidth: 180 }),
            new DB3Client.GenericStringColumnClient({ columnName: "pastText", cellWidth: 180 }),
            new DB3Client.GenericStringColumnClient({ columnName: "pastPersonalText", cellWidth: 180 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isActive" }),
            new DB3Client.IconFieldClient({ columnName: "iconName", cellWidth: 120 }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
            new DB3Client.GenericIntegerColumnClient({ cellWidth: 90, columnName: "strength" }),
        ],
    });

    return <>
        <SettingMarkdown setting="EditEventAttendancesPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};


const EditEventAttendancesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Attendances" basePermission={Permission.admin_events}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventAttendancesPage;
