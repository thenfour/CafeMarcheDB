import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";



const MainContent = () => {
    //const dashboardContext = React.useContext(DashboardContext);

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.eventAttendanceEditorView,
        columns: {
            isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
            text: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.label", columnName, cellWidth: 180 }),
            personalText: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.personalText", columnName, cellWidth: 180 }),
            pastText: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.pastText", columnName, cellWidth: 180 }),
            pastPersonalText: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.pastPersonalText", columnName, cellWidth: 180 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.description", columnName, cellWidth: 200 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, cellWidth: 80 }),
            isActive: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.active", columnName }),
            iconName: columnName => new DB3Client.IconFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.icon", columnName, cellWidth: 120 }),
            color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, cellWidth: 300 }),
            strength: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.attendanceStrength", cellWidth: 90, columnName }),
        },
    });

    return <>
        <LocalizedMarkdown setting="EditEventAttendancesPage_markdown"></LocalizedMarkdown>
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
