// simple text field is setting null (only when incoming from db i guess)
// simple text field should support nullable / not nullable

import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
//import * as db3client from "src/core/db3/components/db3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";

const InstrumentTagListContent = () => {
    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xInstrumentTag,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "text", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 220 }),
        ],
    });

    return <>
        <SettingMarkdown setting="instrumentTagList_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};

const InstrumentTagListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument Tags" basePermission={Permission.admin_instruments}>
            <InstrumentTagListContent />
        </DashboardLayout>
    );
};

export default InstrumentTagListPage;
