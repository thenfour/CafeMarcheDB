import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const MainContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.frontpageGalleryItemEditorView,
        columns: {
            id: DB3Client.pkFieldGen(),
            file: DB3Client.foreignRefFieldGen({}),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
            isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
            caption: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 120 }),
            caption_nl: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 120 }),
            caption_fr: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 120 }),
            displayParams: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
            createdByUser: DB3Client.foreignRefFieldGen({}),
            visiblePermission: DB3Client.foreignRefFieldGen({}),
        },
    });

    return <>
        <SettingMarkdown setting="EditFrontpageGalleryItemsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.frontpageGalleryItemEditorView} />
    </>;
};


const EditFrontpageGalleryItemsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Gallery">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditFrontpageGalleryItemsPage;
