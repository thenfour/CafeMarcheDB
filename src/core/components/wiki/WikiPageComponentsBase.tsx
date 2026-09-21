import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

export const WikiPageTableClientColumns = DB3Client.makeClientColumnSet({
    id: columnName => new DB3Client.PKColumnClient({ columnName }),
    slug: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200, fieldCaption: "Slug", className: "titleText" }),
    namespace: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
    createdAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 150 }),
    createdByUser: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    visiblePermission: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120 }),
    tags: columnName => new DB3Client.TagsFieldClient<db3.WikiPageTagAssignmentPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
});

export const WikiPageTableClientSchema = DB3Client.defineLegacyTableClientSpec({
    table: db3.xWikiPage,
    columns: DB3Client.makeClientColumnSelection(
        WikiPageTableClientColumns.id,
        WikiPageTableClientColumns.slug,
        WikiPageTableClientColumns.namespace,
        WikiPageTableClientColumns.createdAt,
        WikiPageTableClientColumns.createdByUser,
        WikiPageTableClientColumns.visiblePermission,
        WikiPageTableClientColumns.tags,
    ),
});
