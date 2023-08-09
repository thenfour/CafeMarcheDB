// simple text field is setting null (only when incoming from db i guess)
// simple text field should support nullable / not nullable

import { Prisma } from "db";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { CMTableSpec } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { InsertInstrumentTagSchema, InstrumentNameSchema, InstrumentTagColorSchema, InstrumentTagSignificanceSchema, InstrumentTagSortOrderSchema, InstrumentTagTextSchema, UpdateInstrumentTagSchema } from "src/core/schemas/instrumentSchemas";
import deleteInstrumentTagMutation from "src/core/mutations/deleteInstrumentTagMutation";
import getPaginatedInstrumentTags from "src/core/queries/getPaginatedInstrumentTags";
import insertInstrumentTagMutation from "src/core/mutations/insertInstrumentTagMutation";
import updateInstrumentTagMutation from "src/core/mutations/updateInstrumentTagMutation";
import { InstrumentTagSignificance } from "shared/utils";
import { ColorPaletteField, EnumField, PKIDField, SimpleNumberField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMBasicFields";
import { gGeneralPalette } from "shared/color";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3client from "src/core/db3/components/db3Client";
import * as db3 from "src/core/db3/db3";

const tableSpec = new db3client.xTableClientSpec({
    table: db3.xInstrumentTag,
    columns: [
        new db3client.PKColumnClient({ columnName: "id" }),
        new db3client.GenericStringColumnClient({ columnName: "text", cellWidth: 200 }),
        new db3client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
        new db3client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        // significance
    ],
});

const InstrumentTagListContent = () => {
    if (!useAuthorization("admin instrument tags page", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="instrumentTagList_markdown"></SettingMarkdown>
        {/* <CMEditGrid2 spec={InstrumentTagTableSpec} /> */}
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
