import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

export const FileTableClientColumns = DB3Client.makeClientColumnSet({
    publicId: DB3Client.publicIdFieldGen(),
    fileLeafName: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200, fieldCaption: "File name", className: "titleText" }),
    description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
    uploadedAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 150 }),
    uploadedByUser: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    sizeBytes: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
    mimeType: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
    visiblePermission: DB3Client.foreignRefFieldGen({
        selectionView: db3.permissionVisibilityView,
    }),

    tags: columnName => new DB3Client.TagsFieldClient<db3.FileEditorTag>({ columnName, cellWidth: 150, allowDeleteFromCell: false, selectionView: db3.fileTagEditorView }),
    taggedUsers: columnName => new DB3Client.TagsFieldClient<db3.FileEditorUserTag>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedSongs: columnName => new DB3Client.TagsFieldClient<db3.FileEditorSongTag>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedEvents: columnName => new DB3Client.TagsFieldClient<db3.FileEditorEventTag>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedInstruments: columnName => new DB3Client.TagsFieldClient<db3.FileEditorInstrumentTag>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedWikiPages: columnName => new DB3Client.TagsFieldClient<db3.FileEditorWikiPageTag>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    previewFile: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    parentFile: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    externalURI: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
    customData: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    fileCreatedAt: columnName => new DB3Client.DateTimeColumn({ columnName }),
    isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
});
