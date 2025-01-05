import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MainContent = () => {
    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xUserInstrument,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 180, }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "instrument", cellWidth: 180, }),
            new DB3Client.BoolColumnClient({ columnName: "isPrimary" }),
        ],
    });

    return <>
        <SettingMarkdown setting="UserInstrumentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};

const UserInstrumentsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument Tags" basePermission={Permission.admin_instruments}>
            <MainContent />
        </DashboardLayout>
    );
};

export default UserInstrumentsPage;
