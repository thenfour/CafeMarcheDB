import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { BlitzPage } from "@blitzjs/next";
import { Tooltip } from "@mui/material";
import { Suspense } from 'react';
import { gPermissionOrdered } from "shared/permissions";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";

const Inner = () => {
    const dashboardContext = useDashboardContext();

    const codePermissions = gPermissionOrdered;

    const PermissionClientSchema = DB3Client.defineLegacyTableClientSpec({
        table: db3.xPermission,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
            isVisibility: columnName => new DB3Client.BoolColumnClient({ columnName }),
            significance: columnName => new DB3Client.ConstEnumStringFieldClient({ columnName, cellWidth: 120 }),
            color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 120 }),
            iconName: columnName => new DB3Client.IconFieldClient({ columnName, cellWidth: 120 }),
        },
    });

    const dbps = dashboardContext.permission.items;

    // make a list of code permissions which aren't in the db.
    const missingInDb = codePermissions.filter(cp => !dbps.some(dbp => dbp.name === cp));

    return <>
        {missingInDb.map(x => <div key={x} style={{ fontSize: "48px" }}>❗🟥 "{x}" is missing in the db; restarting the server will sync it up</div>)}
        <DB3EditGrid tableSpec={PermissionClientSchema} view={db3.permissionEditorView} renderExtraActions={(x) => {
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
