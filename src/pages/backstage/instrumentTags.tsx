// simple text field is setting null (only when incoming from db i guess)
// simple text field should support nullable / not nullable

import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
//import * as db3client from "src/core/db3/components/db3Client";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

const InstrumentTagListContent = () => {
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.instrumentTagEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            text: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
            description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
            color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 300 }),
            sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
            significance: columnName => new DB3Client.ConstEnumStringFieldClient({ columnName, cellWidth: 220 }),
        },
    });

    return <>
        <SettingMarkdown setting="instrumentTagList_markdown"></SettingMarkdown>
        <DB3EditGrid tableSpec={tableSpec} view={db3.instrumentTagEditorView} />
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
