import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

const tableSpec = DB3Client.defineTableClientSpec({
    view: db3.wikiPageTagEditorView,
    columns: {
        publicId: DB3Client.publicIdFieldGen(),
        text: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.label", columnName, cellWidth: 180 }),
        description: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.description", columnName, cellWidth: 200 }),
        color: columnName => new DB3Client.ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.color", columnName, cellWidth: 300 }),
        sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, cellWidth: 80 }),
    },
});

const MainContent = () => {
    return <>
        <LocalizedMarkdown setting="editWikiPageTags_markdown"></LocalizedMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.wikiPageTagEditorView} />
    </>;
};

const EditWikiPageTagsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Wiki Page Tags">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditWikiPageTagsPage;
