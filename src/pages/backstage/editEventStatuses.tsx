import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const tableSpec = DB3Client.defineTableClientSpec({
    view: db3.eventStatusEditorView,
    columns: {
        publicId: DB3Client.publicIdFieldGen(),
        isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
        label: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.label", columnName, cellWidth: 180 }),
        description: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.description", columnName, cellWidth: 200 }),
        color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, cellWidth: 300 }),
        sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, cellWidth: 80 }),
        significance: columnName => new DB3Client.ConstEnumStringFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.significance", columnName, cellWidth: 120 }),
        iconName: columnName => new DB3Client.IconFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.icon", columnName, cellWidth: 120 }),
    },
});


const MainContent = () => {
    return <>
        <LocalizedMarkdown setting="EditEventStatusesPage_markdown"></LocalizedMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.eventStatusEditorView} />
    </>;
};


const EditEventStatusesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Statuses">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventStatusesPage;
