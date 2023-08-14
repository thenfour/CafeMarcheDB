import { BlitzPage } from "@blitzjs/next";
import * as DB3Client from "src/core/db3/DB3Client";
import { PermissionClientSchema } from "src/core/db3/DB3ClientSchema";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const PermissionsListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Permissions">
            <DB3EditGrid tableSpec={PermissionClientSchema} />
        </DashboardLayout>
    );
};

export default PermissionsListPage;
