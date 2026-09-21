import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";



const MainContent = () => {
    //const dashboardContext = React.useContext(DashboardContext);

    const tableSpec = DB3Client.defineLegacyTableClientSpec({
        table: db3.xEventAttendance,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
            text: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
            personalText: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
            pastText: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
            pastPersonalText: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
            isActive: columnName => new DB3Client.BoolColumnClient({ columnName }),
            iconName: columnName => new DB3Client.IconFieldClient({ columnName, cellWidth: 120 }),
            color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 300 }),
            strength: columnName => new DB3Client.GenericIntegerColumnClient({ cellWidth: 90, columnName }),
        },
    });

    return <>
        <SettingMarkdown setting="EditEventAttendancesPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.eventAttendanceEditorView} />
    </>;
};


const EditEventAttendancesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Attendances">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventAttendancesPage;
