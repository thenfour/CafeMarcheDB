import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";


const InstrumentFunctionalGroupListContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.instrumentFunctionalGroupEditorView,
        columns: [
            new DB3Client.PublicIdColumnClient(),
            new DB3Client.GenericStringColumnClient<"name">({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient<"description">({ columnName: "description", cellWidth: 300 }),
            new DB3Client.ColorColumnClient<"color">({ columnName: "color", cellWidth: 300 }),
            new DB3Client.GenericIntegerColumnClient<"sortOrder">({ columnName: "sortOrder", cellWidth: 80 }),
        ],
    });

    // const tableRenderClient = DB3Client.useTableRenderContext({
    //     requestedCaps: DB3Client.xTableClientCaps.None,
    //     tableSpec,
    // });

    // const x = tableRenderClient.items;

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
