import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const MainContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.frontpageGalleryItemEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            file: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.file",}),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sortOrder", columnName, cellWidth: 80 }),
            isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
            caption: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.caption", columnName, cellWidth: 120 }),
            caption_nl: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.captionDutch", columnName, cellWidth: 120 }),
            caption_fr: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.captionFrench", columnName, cellWidth: 120 }),
            displayParams: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.displayParameters", columnName, cellWidth: 120 }),
            createdByUser: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.createdBy",}),
            visiblePermission: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.visibility",}),
        },
    });

    return <>
        <LocalizedMarkdown setting="EditFrontpageGalleryItemsPage_markdown"></LocalizedMarkdown>
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
