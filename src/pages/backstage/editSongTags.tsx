
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const songTagsTableSpec = DB3Client.defineTableClientSpec({
    view: db3.songTagEditorView,
    columns: {
        id: columnName => new DB3Client.PKColumnClient({ columnName }),
        text: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
        description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
        color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 300 }),
        sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
        significance: columnName => new DB3Client.ConstEnumStringFieldClient({ columnName, cellWidth: 200 }),
        group: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
        indicator: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
        indicatorCssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
    },
});


const MainContent = () => {
    return <>
        <SettingMarkdown setting="editSongTags_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={songTagsTableSpec} view={db3.songTagEditorView} />
    </>;
};


const EditSongTagsPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Song Tags">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongTagsPage;
