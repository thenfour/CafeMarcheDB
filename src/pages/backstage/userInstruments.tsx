import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const MainContent = () => {
    const tableSpec = DB3Client.defineLegacyTableClientSpec({
        table: db3.xUserInstrument,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            user: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 180, }),
            instrument: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 180, }),
            isPrimary: columnName => new DB3Client.BoolColumnClient({ columnName }),
        },
    });

    return <>
        <SettingMarkdown setting="UserInstrumentsPage_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.userInstrumentEditorView} />
    </>;
};

const UserInstrumentsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument Tags">
            <MainContent />
        </DashboardLayout>
    );
};

export default UserInstrumentsPage;
