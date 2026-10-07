import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";

const makeDisplayOnlyColumn = <T extends DB3Client.IColumnClient>(column: T): T => {
    column.editable = false;
    column.renderForNewDialog = undefined;
    column.ApplyClientToPostClient = () => { };
    return column;
};

const MainContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.fileEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            fileLeafName: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.fileName", columnName, cellWidth: 150 }),
            storedLeafName: columnName => makeDisplayOnlyColumn(new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.storedFileName", columnName, cellWidth: 150 })),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.description", columnName, cellWidth: 150 }),
            uploadedAt: columnName => makeDisplayOnlyColumn(new DB3Client.CreatedAtColumn({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.uploadedAt", columnName, cellWidth: 150 })),
            isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
            sizeBytes: columnName => makeDisplayOnlyColumn(new DB3Client.GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.fileSize", columnName, cellWidth: 80 })),
            customData: columnName => makeDisplayOnlyColumn(new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.customData", columnName, cellWidth: 150 })),

            uploadedByUser: columnName => makeDisplayOnlyColumn(new DB3Client.ForeignSingleFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.uploadedBy", columnName, cellWidth: 120, })),
            visiblePermission: DB3Client.foreignRefFieldGen({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.visibility",
                selectionView: db3.permissionVisibilityView,
            }),

            tags: columnName => new DB3Client.TagsFieldClient<db3.FileEditorTag>({
                columnName,
                cellWidth: 150,
                fieldCaptionKey: "db3.fields.tags",
                fieldDescriptionKey: null,
                selectStyle: "inline",
                allowDeleteFromCell: false,
                selectionView: db3.bandFileTagView,
            }),
            taggedUsers: columnName => new DB3Client.TagsFieldClient<db3.FileEditorUserTag>({
                columnName,
                cellWidth: 150,
                fieldCaptionKey: "db3.fields.members",
                fieldDescriptionKey: null,
                selectStyle: "inline",
                allowDeleteFromCell: false,
            }),
            taggedSongs: columnName => new DB3Client.TagsFieldClient<db3.FileEditorSongTag>({ selectStyle: "inline", fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.songs", columnName, cellWidth: 150, allowDeleteFromCell: false }),
            taggedEvents: columnName => new DB3Client.TagsFieldClient<db3.FileEditorEventTag>({
                columnName,
                cellWidth: 150,
                fieldCaptionKey: "db3.fields.events",
                fieldDescriptionKey: null,
                selectStyle: "inline",
                allowDeleteFromCell: false,
            }),
            taggedInstruments: columnName => new DB3Client.TagsFieldClient<db3.FileEditorInstrumentTag>({
                columnName,
                cellWidth: 150,
                fieldCaptionKey: "db3.fields.instruments",
                fieldDescriptionKey: null,
                selectStyle: "inline",
                allowDeleteFromCell: false,
            }),
            taggedWikiPages: columnName => new DB3Client.TagsFieldClient<db3.FileEditorWikiPageTag>({
                columnName,
                cellWidth: 150,
                fieldCaptionKey: "db3.fields.wikiPages",
                fieldDescriptionKey: null,
                selectStyle: "inline",
                allowDeleteFromCell: false,
            }),
        },
    });

    return <>
        <LocalizedMarkdown setting="EditFilesPage_markdown"></LocalizedMarkdown>
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
