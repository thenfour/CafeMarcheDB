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
import { EnumField, PKIDField, SimpleNumberField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMBasicFields";
//import { utils } from "shared/utils";

type DBInstrumentTag = Prisma.InstrumentTagGetPayload<{
    include: {
        instruments: {
            include: {
                instrument: true,
            }
        }
    }
}>;

export const InstrumentTagTableSpec = new CMTableSpec<DBInstrumentTag>({
    devName: "instrument tag",
    CreateMutation: insertInstrumentTagMutation,
    CreateSchema: InsertInstrumentTagSchema,
    GetPaginatedItemsQuery: getPaginatedInstrumentTags,
    UpdateMutation: updateInstrumentTagMutation,
    UpdateSchema: UpdateInstrumentTagSchema,
    DeleteMutation: deleteInstrumentTagMutation,
    GetNameOfRow: (row: DBInstrumentTag) => { return row.text; },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Text", member: "text", zodSchema: InstrumentTagTextSchema, allowNullAndTreatEmptyAsNull: false }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Color", member: "color", zodSchema: InstrumentTagColorSchema, allowNullAndTreatEmptyAsNull: true }),
        new EnumField({ cellWidth: 220, allowNull: true, options: InstrumentTagSignificance, initialNewItemValue: null, label: "Significance", member: "significance", }),
        new SimpleNumberField({ cellWidth: 220, initialNewItemValue: null, allowNull: false, label: "Sort order", member: "sortOrder", zodSchema: InstrumentTagSortOrderSchema }),
    ],
});

const InstrumentTagListContent = () => {
    if (!useAuthorization("admin instrument tags page", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="instrumentTagList_markdown"></SettingMarkdown>
        <CMEditGrid2 spec={InstrumentTagTableSpec} />
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
