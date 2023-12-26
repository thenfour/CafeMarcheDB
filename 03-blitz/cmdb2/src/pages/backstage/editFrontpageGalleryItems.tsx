import { BlitzPage, useParam, useParams } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { parseIntOrNull } from "shared/utils";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MainContent = () => {
    if (!useAuthorization("EditFrontpageGalleryItemsPage", Permission.edit_public_homepage)) {
        throw new Error(`unauthorized`);
    }

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFrontpageGalleryItem,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "file", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "displayParams", cellWidth: 120 }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        ],
    });

    return <>
        <SettingMarkdown settingName="EditFrontpageGalleryItemsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
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
