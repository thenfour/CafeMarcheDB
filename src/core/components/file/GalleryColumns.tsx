import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";

export const galleryColumns = DB3Client.makeClientColumnSet({
    publicId: DB3Client.publicIdFieldGen(),
    file: DB3Client.foreignRefFieldGen({
        fieldCaptionKey: "db3.fields.file", fieldDescriptionKey: null,
        selectionView: db3.fileImageChoiceView
    }),
    sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({
        columnName,
        fieldCaptionKey: "db3.fields.sortOrder", fieldDescriptionKey: null
    }),
    isDeleted: columnName => new DB3Client.BoolColumnClient({
        columnName,
        fieldCaptionKey: "db3.fields.deleted", fieldDescriptionKey: null
    }),
    caption: columnName => new DB3Client.MarkdownStringColumnClient({
        columnName,
        fieldCaptionKey: "db3.fields.caption", fieldDescriptionKey: null
    }),
    caption_nl: columnName => new DB3Client.MarkdownStringColumnClient({
        columnName,
        fieldCaptionKey: "db3.fields.captionDutch", fieldDescriptionKey: null
    }),
    caption_fr: columnName => new DB3Client.MarkdownStringColumnClient({
        columnName,
        fieldCaptionKey: "db3.fields.captionFrench", fieldDescriptionKey: null
    }),
    displayParams: columnName => new DB3Client.GenericStringColumnClient({
        columnName,
        fieldCaptionKey: "db3.fields.displayParameters", fieldDescriptionKey: null
    }),
    visiblePermission: DB3Client.foreignRefFieldGen({
        fieldCaptionKey: "db3.fields.visibility", fieldDescriptionKey: null,
        selectionView: db3.permissionVisibilityView
    }),
});

export const galleryColumnSelection = DB3Client.makeClientColumnSelection(
    galleryColumns.publicId,
    galleryColumns.file,
    galleryColumns.sortOrder,
    galleryColumns.isDeleted,
    galleryColumns.caption,
    galleryColumns.caption_nl,
    galleryColumns.caption_fr,
    galleryColumns.displayParams,
    galleryColumns.visiblePermission,
);
