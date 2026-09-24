import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const tableSpec = DB3Client.defineTableClientSpec({
    view: db3.fileTagEditorView,
    columns: {
        publicId: DB3Client.publicIdFieldGen(),
        text: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
        description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
        color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 300 }),
        sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
        significance: columnName => new DB3Client.ConstEnumStringFieldClient({ columnName, cellWidth: 120 }),
    },
});

const MainContent = () => {
    return <>
        <SettingMarkdown setting="EditFileTagsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.fileTagEditorView} />
    </>;
};


const EditFileTagsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="File Tags">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditFileTagsPage;
