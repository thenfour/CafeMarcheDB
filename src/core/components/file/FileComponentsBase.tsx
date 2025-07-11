import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

export const FileTableClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    fileLeafName: new DB3Client.GenericStringColumnClient({ columnName: "fileLeafName", cellWidth: 200, fieldCaption: "File name", className: "titleText" }),
    description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
    uploadedAt: new DB3Client.CreatedAtColumn({ columnName: "uploadedAt", cellWidth: 150 }),
    uploadedByUser: new DB3Client.ForeignSingleFieldClient({ columnName: "uploadedByUser", cellWidth: 120 }),
    sizeBytes: new DB3Client.GenericIntegerColumnClient({ columnName: "sizeBytes", cellWidth: 80 }),
    mimeType: new DB3Client.GenericStringColumnClient({ columnName: "mimeType", cellWidth: 120 }),
    visiblePermission: new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120 }),
    tags: new DB3Client.TagsFieldClient<db3.FileTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
    taggedUsers: new DB3Client.TagsFieldClient<db3.FileUserTagPayload>({ columnName: "taggedUsers", cellWidth: 150, allowDeleteFromCell: false }),
    taggedSongs: new DB3Client.TagsFieldClient<db3.FileSongTagPayload>({ columnName: "taggedSongs", cellWidth: 150, allowDeleteFromCell: false }),
    taggedEvents: new DB3Client.TagsFieldClient<db3.FileEventTagPayload>({ columnName: "taggedEvents", cellWidth: 150, allowDeleteFromCell: false }),
    taggedInstruments: new DB3Client.TagsFieldClient<db3.FileInstrumentTagPayload>({ columnName: "taggedInstruments", cellWidth: 150, allowDeleteFromCell: false }),
    taggedWikiPages: new DB3Client.TagsFieldClient<db3.FileWikiPageTagPayload>({ columnName: "taggedWikiPages", cellWidth: 150, allowDeleteFromCell: false }),
    previewFile: new DB3Client.ForeignSingleFieldClient({ columnName: "previewFile", cellWidth: 120 }),
    parentFile: new DB3Client.ForeignSingleFieldClient({ columnName: "parentFile", cellWidth: 120 }),
    externalURI: new DB3Client.GenericStringColumnClient({ columnName: "externalURI", cellWidth: 200 }),
    customData: new DB3Client.GenericStringColumnClient({ columnName: "customData", cellWidth: 150 }),
    fileCreatedAt: new DB3Client.DateTimeColumn({ columnName: "fileCreatedAt" }),
    isDeleted: new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
};
