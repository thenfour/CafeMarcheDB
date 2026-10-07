
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";



const MainContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.songCreditTypeEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            text: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.label", columnName, cellWidth: 180 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.description", columnName, cellWidth: 200 }),
            color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, cellWidth: 300 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, cellWidth: 80 }),
        },
    });

    return <>
        <LocalizedMarkdown setting="editSongCreditTypes_markdown"></LocalizedMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.songCreditTypeEditorView} />
    </>;
};


const EditSongCreditTypesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Song Credit Types">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongCreditTypesPage;
