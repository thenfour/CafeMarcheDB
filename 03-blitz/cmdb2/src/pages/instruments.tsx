import { Prisma } from "db";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { CMTableSpec, PKIDField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
//import { InstrumentTableSpec } from "src/core/CMDBInstrument";
//import { UserTableSpec } from "src/core/CMDBUser";
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
//import { CMEditGrid2 } from "src/core/cmdashboard/CMEditGrid2";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import insertInstrumentMutation from "src/core/mutations/insertInstrumentMutation";
import { InsertInstrumentSchema, InstrumentNameSchema, UpdateInstrumentSchema } from "src/core/schemas/instrumentSchemas";
import getPaginatedInstruments from "src/core/queries/getPaginatedInstruments";
import updateInstrumentMutation from "src/core/mutations/updateInstrumentMutation";
import deleteInstrumentMutation from "src/core/mutations/deleteInstrumentMutation";

type DBInstrument = Prisma.InstrumentGetPayload<{
    include: {
        functionalGroup: true,
        instrumentTags: { include: { tag: true } }
    }
}>;

export const InstrumentTableSpec = new CMTableSpec<DBInstrument>({
    devName: "instrument",
    CreateMutation: insertInstrumentMutation,
    CreateSchema: InsertInstrumentSchema,
    GetPaginatedItemsQuery: getPaginatedInstruments,
    UpdateMutation: updateInstrumentMutation,
    UpdateSchema: UpdateInstrumentSchema,
    DeleteMutation: deleteInstrumentMutation,
    GetNameOfRow: (row: DBInstrument) => { return row.name; },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Name", member: "name", zodSchema: InstrumentNameSchema }),
    ],
});


const InstrumentListContent = () => {
    if (!useAuthorization("admin instruments page", Permission.admin_general)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="instrumentList_markdown"></SettingMarkdown>
        <CMEditGrid2 spec={InstrumentTableSpec} />
    </>;
};

const InstrumentListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <InstrumentListContent />
        </DashboardLayout>
    );
};

export default InstrumentListPage;
