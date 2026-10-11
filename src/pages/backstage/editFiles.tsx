import { FileTableClientColumns } from "src/core/components/file/FileComponentsBase";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { BandLocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";

const MainContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.fileEditorView,
        columns: DB3Client.makeClientColumnSelection(
            FileTableClientColumns.publicId,
            FileTableClientColumns.fileLeafName,
            FileTableClientColumns.storedLeafName,
            FileTableClientColumns.description,
            FileTableClientColumns.uploadedAt,
            FileTableClientColumns.uploadedByUser,
            FileTableClientColumns.isDeleted,
            FileTableClientColumns.tags,
            FileTableClientColumns.taggedUsers,
            FileTableClientColumns.taggedSongs,
            FileTableClientColumns.taggedEvents,
            FileTableClientColumns.taggedInstruments,
            FileTableClientColumns.taggedWikiPages,
            FileTableClientColumns.visiblePermission,
            FileTableClientColumns.mimeType,
            FileTableClientColumns.sizeBytes,
            FileTableClientColumns.customData,
        ),
    });

    return <>
        <BandLocalizedMarkdown id="EditFilesPage_markdown"></BandLocalizedMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.fileEditorView}
        />
    </>;
};


const EditFilesPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Files">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditFilesPage;
