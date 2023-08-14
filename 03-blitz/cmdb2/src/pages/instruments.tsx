import { BlitzPage } from "@blitzjs/next";
import { Chip } from "@mui/material";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xInstrument,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
        new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new DB3Client.ForeignSingleFieldClient<db3.InstrumentFunctionalGroupForeignModel>({ columnName: "functionalGroup", cellWidth: 200 }),
        new DB3Client.TagsFieldClient<db3.InstrumentTagAssociationModel>({ columnName: "instrumentTags", cellWidth: 220 }),
    ],
});


const InstrumentListContent = () => {
    if (!useAuthorization("admin instruments page", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="instrumentList_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} />
    </>;
};

const InstrumentListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Instrument admin">
            <InstrumentListContent />
        </DashboardLayout>
    );
};

export default InstrumentListPage;
