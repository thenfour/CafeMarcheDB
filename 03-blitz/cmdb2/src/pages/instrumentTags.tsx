// simple text field is setting null (only when incoming from db i guess)
// simple text field should support nullable / not nullable

import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3client from "src/core/db3/components/db3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const tableSpec = new db3client.xTableClientSpec({
    table: db3.xInstrumentTag,
    columns: [
        new db3client.PKColumnClient({ columnName: "id" }),
        new db3client.GenericStringColumnClient({ columnName: "text", cellWidth: 200 }),
        new db3client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
        new db3client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new db3client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 220 }),
    ],
});

const InstrumentTagListContent = () => {
    if (!useAuthorization("admin instrument tags page", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="instrumentTagList_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};

const InstrumentTagListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument Tags">
            <InstrumentTagListContent />
        </DashboardLayout>
    );
};

export default InstrumentTagListPage;
