import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";


const InstrumentFunctionalGroupListContent = () => {
    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xInstrumentFunctionalGroup,
        columns: [
            new DB3Client.PublicIdColumnClient(),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 300 }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        ],
    });

    return <>
        <SettingMarkdown setting="InstrumentFunctionalGroupList_markdown"></SettingMarkdown>
        <DB3EditGrid
            tableSpec={tableSpec}
            view={db3.instrumentFunctionalGroupEditorView}
        />
    </>;
};

const InstrumentFunctionalGroupListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="InstrumentGroups">
            <InstrumentFunctionalGroupListContent />
        </DashboardLayout>
    );
};

export default InstrumentFunctionalGroupListPage;
