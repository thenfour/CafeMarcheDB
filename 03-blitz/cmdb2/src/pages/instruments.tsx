import { Prisma } from "db";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { CMTableSpec } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
//import { InstrumentTableSpec } from "src/core/CMDBInstrument";
//import { UserTableSpec } from "src/core/CMDBUser";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
//import { CMEditGrid2 } from "src/core/cmdashboard/CMEditGrid2";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import insertInstrumentMutation from "src/core/mutations/insertInstrumentMutation";
import { InsertInstrumentSchema, InstrumentNameSchema, UpdateInstrumentSchema } from "src/core/schemas/instrumentSchemas";
import getPaginatedInstruments from "src/core/queries/getPaginatedInstruments";
import updateInstrumentMutation from "src/core/mutations/updateInstrumentMutation";
import deleteInstrumentMutation from "src/core/mutations/deleteInstrumentMutation";
import { ColorSwatch, PKIDField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMBasicFields";
import { TagsField, TagsInsertFromStringParams, TagsRenderAsChipParams } from "src/core/cmdashboard/dbcomponents2/CMTagsField";
import getAllInstrumentTags from "src/core/queries/getAllInstrumentTags";
import insertInstrumentTagMutation from "src/core/mutations/insertInstrumentTagMutation";
import { gGeneralPalette } from "shared/color";
import { Chip } from "@mui/material";
import insertInstrumentTagFromStringAsAssociationMutation from "src/core/mutations/insertInstrumentTagFromStringAsAssociationMutation";

type I = Prisma.InstrumentGetPayload<{
    include: {
        functionalGroup: true,
        instrumentTags: { include: { tag: true } }
    }
}>;

type A = Prisma.InstrumentTagAssociationGetPayload<{
    include: {
        tag: true,
    }
}>;

// type T = Prisma.InstrumentTagGetPayload<{
//     include: { instruments: true },
// }>;

type WhereInput = Prisma.InstrumentWhereInput;

export class InstrumentTagsField extends TagsField<I, A, Prisma.InstrumentWhereInput, Prisma.InstrumentTagWhereInput> {
    constructor() {
        super({
            cellWidth: 220,
            localPkMember: "id",
            member: "instrumentTags",
            associationSpec: {
                label: "Tags",
                getAllAssociationOptionsQuery: getAllInstrumentTags, // returns Association[] where many may be mocked up.
                getForeignQuickFilterWhereClause: (query: string): Prisma.InstrumentTagWhereInput => {
                    return { text: { contains: query } };
                },

                doesItemExactlyMatchText: (item: A, filterText: string) => {
                    return item.tag.text.trim().toLowerCase() === filterText.trim().toLowerCase();
                },

                allowInsertFromString: true,
                insertFromStringMutation: insertInstrumentTagFromStringAsAssociationMutation, // creates a foreign item, returns a MOCK association
                insertFromString: async (params: TagsInsertFromStringParams) => {
                    const payload: (Prisma.InstrumentTagCreateInput & { localPk: number | null }) = {
                        localPk: params.localPk,
                        text: params.input,
                        sortOrder: 0,
                    };
                    return await params.mutation(payload);
                }, // create an object from string asynchronously.
                insertFromStringSchema: null,

                getForeignPKOfAssociation: (a: A) => a.tagId, // in order to compare for equality

                renderAsChip: (args: TagsRenderAsChipParams<A>) => {
                    if (!args.value) {
                        return <>--</>;
                    }
                    return <Chip
                        size="small"
                        label={`${args.value.tag.text}`}
                        onDelete={args.onDelete}
                    />;
                },
                renderAsListItem: (props, value, selected) => {
                    return <li {...props}>
                        {selected && <DoneIcon />}
                        <ColorSwatch selected={true} color={gGeneralPalette.findColorPaletteEntry(value.tag.color)} />
                        {value.tag.text}
                        {selected && <CloseIcon />}
                    </li>
                },
            }
        });
    }

    // for filtering 
    getQuickFilterWhereClause = (query: string): Prisma.InstrumentWhereInput => {
        return {
            instrumentTags: { some: { tag: { text: { contains: query } } } }
        };
    };
};

export const InstrumentTableSpec = new CMTableSpec<I>({
    devName: "instrument",
    CreateMutation: insertInstrumentMutation,
    CreateSchema: InsertInstrumentSchema,
    GetPaginatedItemsQuery: getPaginatedInstruments,
    UpdateMutation: updateInstrumentMutation,
    UpdateSchema: UpdateInstrumentSchema,
    DeleteMutation: deleteInstrumentMutation,
    GetNameOfRow: (row: I) => { return row.name; },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Name", member: "name", zodSchema: InstrumentNameSchema, allowNullAndTreatEmptyAsNull: false }),
        new InstrumentTagsField(),
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