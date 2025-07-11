import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";

const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xWikiPageTag,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "text", cellWidth: 180 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 200 }),
    ],
});

const MainContent = () => {
    return <>
        <SettingMarkdown setting="editWikiPageTags_markdown"></SettingMarkdown>
        <div>Wiki Page Tags admin page will be available after database migration.</div>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};

const EditWikiPageTagsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Wiki Page Tags" basePermission={Permission.admin_wiki_pages}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditWikiPageTagsPage;
