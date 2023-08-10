import { BlitzPage } from "@blitzjs/next";
import { Chip } from "@mui/material";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
//import { InstrumentTableSpec } from "src/core/CMDBInstrument";
//import { UserTableSpec } from "src/core/CMDBUser";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
//import { CMEditGrid2 } from "src/core/cmdashboard/CMEditGrid2";
//import * as db3client from "src/core/db3/components/DB3ClientCore";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
//import * as db3fsclient from "src/core/db3/components/db3ForeignSingleFieldClient";
//import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';

// type I = Prisma.InstrumentGetPayload<{
//     include: {
//         functionalGroup: true,
//         instrumentTags: { include: { tag: true } }
//     }
// }>;

// type A = Prisma.InstrumentTagAssociationGetPayload<{
//     include: {
//         tag: true,
//     }
// }>;

// type DBFunctionalGroup = Prisma.InstrumentFunctionalGroupGetPayload<{}>;

// export class InstrumentTagsField extends TagsField<I, A, Prisma.InstrumentWhereInput, Prisma.InstrumentTagWhereInput> {
//     constructor() {
//         super({
//             cellWidth: 220,
//             localPkMember: "id",
//             member: "instrumentTags",
//             associationSpec: {
//                 label: "Tags",
//                 getForeignPKOfAssociation: (a: A) => a.tagId, // in order to compare for equality
//                 getAllAssociationOptionsQuery: getAllInstrumentTags, // returns Association[] where many may be mocked up.
//                 getForeignQuickFilterWhereClause: (query: string): Prisma.InstrumentTagWhereInput => {
//                     return { text: { contains: query } };
//                 },
//                 doesItemExactlyMatchText: (item: A, filterText: string) => {
//                     return item.tag.text.trim().toLowerCase() === filterText.trim().toLowerCase();
//                 },
//                 allowInsertFromString: true,
//                 insertFromStringSchema: null,
//                 insertFromStringMutation: insertInstrumentTagFromStringAsAssociationMutation, // creates a foreign item, returns a MOCK association
//                 insertFromString: async (params: TagsInsertFromStringParams) => {
//                     const payload: (Prisma.InstrumentTagCreateInput & { localPk: number | null }) = {
//                         localPk: params.localPk,
//                         text: params.input,
//                         sortOrder: 0,
//                     };
//                     return await params.mutation(payload);
//                 }, // create an object from string asynchronously.

//                 renderAsChip: (args: TagsRenderAsChipParams<A>) => {
//                     if (!args.value) {
//                         return <>--</>;
//                     }
//                     return <Chip
//                         size="small"
//                         label={`${args.value.tag.text}`}
//                         onDelete={args.onDelete}
//                     />;
//                 },
//                 renderAsListItem: (props, value, selected) => {
//                     return <li {...props}>
//                         {selected && <DoneIcon />}
//                         <ColorSwatch selected={true} color={gGeneralPalette.findColorPaletteEntry(value.tag.color)} />
//                         {value.tag.text}
//                         {selected && <CloseIcon />}
//                     </li>
//                 },
//             }
//         });
//     }

//     // for filtering 
//     getQuickFilterWhereClause = (query: string): Prisma.InstrumentWhereInput => {
//         return {
//             instrumentTags: { some: { tag: { text: { contains: query } } } }
//         };
//     };
// };


// export class InstrumentFunctionalGroupField extends ForeignSingleField<I, DBFunctionalGroup, Prisma.InstrumentWhereInput, Prisma.InstrumentFunctionalGroupWhereInput> {
//     constructor() {
//         super({
//             allowNull: true,
//             cellWidth: 220,
//             fkidMember: "functionalGroupId",
//             member: "functionalGroup",
//             foreignSpec: {
//                 label: "Functional group",
//                 pkMember: "id",

//                 getQuickFilterWhereClause: (query: string): Prisma.InstrumentFunctionalGroupWhereInput => {
//                     return { name: { contains: query } };
//                 },
//                 getAllOptionsQuery: getAllInstrumentFunctionalGroups,

//                 allowInsertFromString: true,
//                 insertFromStringMutation: insertInstrumentFunctionalGroupMutation,
//                 insertFromString: async (params: InsertFromStringParams) => {
//                     return await params.mutation({
//                         name: params.input,
//                         description: "",
//                         sortOrder: 0,
//                     });
//                 },

//                 doesItemExactlyMatchText: (item: DBFunctionalGroup, filterText: string) => {
//                     return (item.name.trim().toLowerCase() === filterText.trim().toLowerCase()) ||
//                         (item.description.trim().toLowerCase() === filterText.trim().toLowerCase());
//                 },

//                 renderAsChip: (args: RenderAsChipParams<DBFunctionalGroup>) => {
//                     if (!args.value) {
//                         return <>--</>;
//                     }
//                     return <Chip
//                         size="small"
//                         label={`${args.value.name}`}
//                         onDelete={args.onDelete}
//                     />;
//                 },

//                 renderAsListItem: (props, value, selected) => {
//                     return <li {...props}>
//                         {selected && <DoneIcon />}
//                         {value.name}
//                         {value.description}
//                         {selected && <CloseIcon />}
//                     </li>
//                 },
//             }
//         });
//     }

//     getQuickFilterWhereClause = (query: string): Prisma.InstrumentWhereInput => {
//         return { functionalGroup: { name: { contains: query } } };
//     };
// };



// export const InstrumentTableSpec = new CMTableSpec<I, Prisma.InstrumentWhereInput>({
//     devName: "instrument",
//     CreateMutation: insertInstrumentMutation,
//     CreateSchema: InsertInstrumentSchema,
//     GetPaginatedItemsQuery: getPaginatedInstruments,
//     UpdateMutation: updateInstrumentMutation,
//     UpdateSchema: UpdateInstrumentSchema,
//     DeleteMutation: deleteInstrumentMutation,
//     GetNameOfRow: (row: I) => { return row.name; },
//     fields: [
//         new PKIDField({ member: "id" }),
//         new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Name", member: "name", zodSchema: InstrumentNameSchema, allowNullAndTreatEmptyAsNull: false }),
//         new InstrumentTagsField(),
//         new InstrumentFunctionalGroupField(),
//     ],
// });


const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xInstrument,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
        new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
        new DB3Client.ForeignSingleFieldFieldClient<db3.InstrumentFunctionalGroupForeignModel>({
            columnName: "functionalGroup",
            cellWidth: 200,
            renderAsChip: (args) => {
                if (!args.value) {
                    return <>--</>;
                }
                return <Chip
                    size="small"
                    label={`${args.value.name}`}
                    onDelete={args.onDelete}
                />;
            },
            renderAsListItem: (props, value, selected) => {
                return <li {...props}>
                    {selected && <DoneIcon />}
                    {value.name}
                    {value.description}
                    {selected && <CloseIcon />}
                </li>
            },
        }),
        // tags
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
        <DashboardLayout title="Users">
            <InstrumentListContent />
        </DashboardLayout>
    );
};

export default InstrumentListPage;
