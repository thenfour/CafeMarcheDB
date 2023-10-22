import { BlitzPage } from "@blitzjs/next";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const PermissionsListPage: BlitzPage = () => {

    const PermissionClientSchema = new DB3Client.xTableClientSpec({
        table: db3.xPermission,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isVisibility" }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 120 }),
            new DB3Client.IconFieldClient({ columnName: "iconName", cellWidth: 120 }),
        ],
    });

    return (
        <DashboardLayout title="Permissions">
            <DB3EditGrid tableSpec={PermissionClientSchema} />
        </DashboardLayout>
    );
};

export default PermissionsListPage;
