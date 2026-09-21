import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const tableSpec = DB3Client.defineTableClientSpec({
    view: db3.eventTagEditorView,
    columns: {
        id: columnName => new DB3Client.PKColumnClient({ columnName }),
        text: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
        description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
        color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 300 }),
        sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
        significance: columnName => new DB3Client.ConstEnumStringFieldClient({ columnName, cellWidth: 120 }),
        visibleOnFrontpage: columnName => new DB3Client.BoolColumnClient({ columnName }),
    },
});

const MainContent = () => {
    return <>
        <SettingMarkdown setting="EditEventTagsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.eventTagEditorView} />
    </>;
};


const EditEventTagsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Tags">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventTagsPage;
