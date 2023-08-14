import * as db3 from "./db3";
import * as DB3Client from "./DB3Client";

export const RoleClientSchema = new DB3Client.xTableClientSpec({
    table: db3.xRole,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new DB3Client.TagsFieldClient({ columnName: "permissions", cellWidth: 200 }),
    ],
});

export const PermissionClientSchema = new DB3Client.xTableClientSpec({
    table: db3.xPermission,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
    ],
});
