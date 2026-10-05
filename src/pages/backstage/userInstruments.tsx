import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";


const MainContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.userInstrumentEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            user: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 180, }),
            instrument: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 180, }),
            isPrimary: columnName => new DB3Client.BoolColumnClient({ columnName }),
        },
    });

    return <>
        <LocalizedMarkdown setting="UserInstrumentsPage_markdown"></LocalizedMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.userInstrumentEditorView} />
    </>;
};

const UserInstrumentsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="User Instruments">
            <MainContent />
        </DashboardLayout>
    );
};

export default UserInstrumentsPage;
