import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

export const FileTableClientColumns = DB3Client.makeClientColumnSet({
    id: columnName => new DB3Client.PKColumnClient({ columnName }),
    fileLeafName: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200, fieldCaption: "File name", className: "titleText" }),
    description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
    uploadedAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 150 }),
    uploadedByUser: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    sizeBytes: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
    mimeType: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
    visiblePermission: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    tags: columnName => new DB3Client.TagsFieldClient<db3.FileTagAssignmentPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedUsers: columnName => new DB3Client.TagsFieldClient<db3.FileUserTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedSongs: columnName => new DB3Client.TagsFieldClient<db3.FileSongTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedEvents: columnName => new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedInstruments: columnName => new DB3Client.TagsFieldClient<db3.FileInstrumentTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    taggedWikiPages: columnName => new DB3Client.TagsFieldClient<db3.FileWikiPageTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
    previewFile: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    parentFile: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    externalURI: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
    customData: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    fileCreatedAt: columnName => new DB3Client.DateTimeColumn({ columnName }),
    isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
});
