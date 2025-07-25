import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

export const WikiPageTableClientColumns = {
    id: new DB3Client.PKColumnClient({ columnName: "id" }),
    slug: new DB3Client.GenericStringColumnClient({ columnName: "slug", cellWidth: 200, fieldCaption: "Slug", className: "titleText" }),
    namespace: new DB3Client.GenericStringColumnClient({ columnName: "namespace", cellWidth: 150 }),
    createdAt: new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 150 }),
    createdByUser: new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120 }),
    visiblePermission: new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120 }),
    tags: new DB3Client.TagsFieldClient<db3.WikiPageTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
};

export const WikiPageTableClientSchema = new DB3Client.xTableClientSpec({
    table: db3.xWikiPage,
    columns: [
        WikiPageTableClientColumns.id,
        WikiPageTableClientColumns.slug,
        WikiPageTableClientColumns.namespace,
        WikiPageTableClientColumns.createdAt,
        WikiPageTableClientColumns.createdByUser,
        WikiPageTableClientColumns.visiblePermission,
        WikiPageTableClientColumns.tags,
    ],
});
