import { Prisma } from "db";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xInstrumentFunctionalGroup,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
        new DB3Client.GenericStringColumnClient({ columnName: "description", cellWidth: 300 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
    ],
});


const InstrumentFunctionalGroupListContent = () => {
    if (!useAuthorization("admin instrument functional groups page", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="InstrumentFunctionalGroupList_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};

const InstrumentFunctionalGroupListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument Tags">
            <InstrumentFunctionalGroupListContent />
        </DashboardLayout>
    );
};

export default InstrumentFunctionalGroupListPage;
