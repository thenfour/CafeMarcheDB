import { Prisma } from "db";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { CMTableSpec } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";
//import { InsertInstrumentTagSchema, InstrumentNameSchema, InstrumentTagColorSchema, InstrumentTagSignificanceSchema, InstrumentTagSortOrderSchema, InstrumentTagTextSchema, UpdateInstrumentTagSchema } from "src/core/schemas/instrumentSchemas";
//import deleteInstrumentTagMutation from "src/core/mutations/deleteInstrumentTagMutation";
//import getPaginatedInstrumentTags from "src/core/queries/getPaginatedInstrumentTags";
//import insertInstrumentTagMutation from "src/core/mutations/insertInstrumentTagMutation";
//import updateInstrumentTagMutation from "src/core/mutations/updateInstrumentTagMutation";
//import { InstrumentTagSignificance } from "shared/utils";
import { PKIDField, SimpleNumberField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMBasicFields";
import { InsertInstrumentFunctionalGroupSchema, InstrumentFunctionalGroupDescriptionSchema, InstrumentFunctionalGroupNameSchema, InstrumentFunctionalGroupSortOrderSchema, UpdateInstrumentFunctionalGroupSchema } from "src/core/schemas/instrumentSchemas";
//import { gGeneralPalette } from "shared/color";

type DBInstrumentFunctionalGroup = Prisma.InstrumentFunctionalGroupGetPayload<{}>;

export const InstrumentFunctionalGroupTableSpec = new CMTableSpec<DBInstrumentFunctionalGroup, Prisma.InstrumentFunctionalGroupWhereInput>({
    devName: "instrument functional group",

    GetPaginatedItemsQuery: getPaginatedInstrumentFunctionalGroups,

    CreateMutation: insertInstrumentFunctionalGroupMutation,
    CreateSchema: InsertInstrumentFunctionalGroupSchema,
    UpdateMutation: updateInstrumentFunctionalGroupMutation,
    UpdateSchema: UpdateInstrumentFunctionalGroupSchema,
    DeleteMutation: deleteInstrumentFunctionalGroupMutation,
    GetNameOfRow: (row: DBInstrumentFunctionalGroup) => { return row.name; },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Text", member: "text", zodSchema: InstrumentFunctionalGroupNameSchema, allowNullAndTreatEmptyAsNull: false }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Description", member: "description", zodSchema: InstrumentFunctionalGroupDescriptionSchema, allowNullAndTreatEmptyAsNull: false }),
        new SimpleNumberField({ cellWidth: 220, initialNewItemValue: null, allowNull: false, label: "Sort order", member: "sortOrder", zodSchema: InstrumentFunctionalGroupSortOrderSchema }),
    ],
});

const InstrumentFunctionalGroupListContent = () => {
    if (!useAuthorization("admin instrument functional groups page", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="InstrumentFunctionalGroupList_markdown"></SettingMarkdown>
        <CMEditGrid2 spec={InstrumentFunctionalGroupTableSpec} />
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
