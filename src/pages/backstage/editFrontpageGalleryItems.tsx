import { BlitzPage, useParam, useParams } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MainContent = () => {
    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFrontpageGalleryItem,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "file", cellWidth: 120, }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption", cellWidth: 120 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption_nl", cellWidth: 120 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption_fr", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "displayParams", cellWidth: 120 }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, }),
        ],
    });

    return <>
        <SettingMarkdown setting="EditFrontpageGalleryItemsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};


const EditFrontpageGalleryItemsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Gallery" basePermission={Permission.edit_public_homepage}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditFrontpageGalleryItemsPage;
