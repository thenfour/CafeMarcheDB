import { Prisma } from "db";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { CMTableSpec, PKIDField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { InsertInstrumentTagSchema, InstrumentNameSchema, InstrumentTagColorSchema, InstrumentTagSignificanceSchema, InstrumentTagTextSchema, UpdateInstrumentTagSchema } from "src/core/schemas/instrumentSchemas";
import deleteInstrumentTagMutation from "src/core/mutations/deleteInstrumentTagMutation";
import getPaginatedInstrumentTags from "src/core/queries/getPaginatedInstrumentTags";
import insertInstrumentTagMutation from "src/core/mutations/insertInstrumentTagMutation";
import updateInstrumentTagMutation from "src/core/mutations/updateInstrumentTagMutation";

type DBInstrumentTag = Prisma.InstrumentTagGetPayload<{
    include: {
        instruments: {
            include: {
                instrument: true,
            }
        }
    }
}>;

// export const UpdateInstrumentTagSchema = z.object({
//     id: z.number(),
//     text: InstrumentTagTextSchema.optional(),
//     color: z.string().optional(),
//     significance: z.string().optional(),
//     sortOrder: z.number().optional(),
// });

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
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Text", member: "text", zodSchema: InstrumentTagTextSchema }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Color", member: "color", zodSchema: InstrumentTagColorSchema }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Significance", member: "significance", zodSchema: InstrumentTagSignificanceSchema }),
        //new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Sort order", member: "sortOrder", zodSchema: InstrumentNameSchema }),
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
