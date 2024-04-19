import { BlitzPage } from "@blitzjs/next";
import { Tooltip } from "@mui/material";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const Inner = () => {

    const codePermissions = Object.keys(Permission);

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

    const dbps = API.users.getAllPermissions();

    // make a list of code permissions which aren't in the db.
    const missingInDb = codePermissions.filter(cp => !dbps.items.some(dbp => dbp.name === cp));

    return <>
        {missingInDb.map(x => <div key={x} style={{ fontSize: "48px" }}>❗🟥 "{x}" is missing in the db; restarting the server will sync it up</div>)}
        <DB3EditGrid tableSpec={PermissionClientSchema} renderExtraActions={(x) => {
            return <div>{codePermissions.some(k => k === x.row.name) ? (
                <Tooltip title="this permission is in sync with code."><div>☑</div></Tooltip>)
                : (<Tooltip title="this permission is not known in code; it can probably be deleted.">
                    <div style={{ display: "flex", whiteSpace: "nowrap" }}>❗🟥Unknown</div></Tooltip>)}</div>
        }} />
    </>;
}

const PermissionsListPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Permissions">
            <Suspense>
                <Inner />
            </Suspense>
        </DashboardLayout>
    );
};

export default PermissionsListPage;
