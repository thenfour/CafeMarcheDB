
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const songTagsTableSpec = new DB3Client.xTableClientSpec({
    table: db3.xSongTag,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "text", cellWidth: 180 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 200 }),
        new DB3Client.GenericStringColumnClient({ columnName: "group", cellWidth: 180 }),
        new DB3Client.GenericStringColumnClient({ columnName: "indicator", cellWidth: 180 }),
        new DB3Client.GenericStringColumnClient({ columnName: "indicatorCssClass", cellWidth: 180 }),
    ],
});


const MainContent = () => {
    return <>
        <SettingMarkdown setting="editSongTags_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={songTagsTableSpec} />
    </>;
};


const EditSongTagsPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Song Tags" basePermission={Permission.admin_songs}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditSongTagsPage;
