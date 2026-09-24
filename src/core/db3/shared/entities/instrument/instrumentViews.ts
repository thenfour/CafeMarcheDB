import { z } from "zod";
import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { isPublicId, type InstrumentFunctionalGroupPublicId } from "shared/publicId";
import { defineCrudView } from "../../core/db3CrudView";
import { type ClientOf, type DtoOf, defineView } from "../../core/db3View";
import {
    instrumentDashboardView,
    instrumentFunctionalGroupDashboardView,
} from "../../references/dashboardReferences";
import {
    xInstrument,
    xInstrumentFunctionalGroup,
    xInstrumentTag,
} from "../../schema/instrument";
import {
    InstrumentTagAssociationNaturalOrderBy,
} from "../../schema/prismArgs";

const InstrumentFunctionalGroupPublicIdSchema = z.custom<InstrumentFunctionalGroupPublicId>(
    (value): value is InstrumentFunctionalGroupPublicId => isPublicId(value),
    "Expected an InstrumentFunctionalGroup public ID.",
);

// The list view deliberately makes non-identity fields optional. Its selection
// is the maximum requested shape; per-field authorization may omit any of them.
const InstrumentFunctionalGroupListDtoSchema = z.object({
    publicId: InstrumentFunctionalGroupPublicIdSchema,
    name: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
    color: z.string().nullable().optional(),
});

const InstrumentTagDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
    color: z.string().nullable().optional(),
    significance: z.string().nullable().optional(),
});

const InstrumentTagAssociationEditorDtoSchema = z.object({
    id: z.number().int(),
    instrumentId: z.number().int().optional(),
    tagId: z.number().int().optional(),
    tag: InstrumentTagDtoSchema.optional(),
});

const InstrumentEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().optional(),
    autoAssignFileLeafRegex: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    functionalGroupId: InstrumentFunctionalGroupPublicIdSchema.optional(),
    functionalGroup: InstrumentFunctionalGroupListDtoSchema.optional(),
    instrumentTags: z.array(InstrumentTagAssociationEditorDtoSchema).optional(),
});

const instrumentEditorBaseSelection = ZodToPrismaSelection(InstrumentEditorDtoSchema);
const instrumentEditorSelection = Prisma.validator<Prisma.InstrumentDefaultArgs>()({
    select: {
        ...instrumentEditorBaseSelection.select,
        instrumentTags: {
            ...instrumentEditorBaseSelection.select.instrumentTags,
            orderBy: InstrumentTagAssociationNaturalOrderBy,
        },
    },
});

export const instrumentFunctionalGroupListView = defineView({
    viewID: "InstrumentFunctionalGroup_List",
    entity: xInstrumentFunctionalGroup,
    dtoSchema: InstrumentFunctionalGroupListDtoSchema,
    hydrate: dto => dto,
});

export const instrumentFunctionalGroupEditorView = defineCrudView({
    viewID: "InstrumentFunctionalGroup_Editor",
    entity: xInstrumentFunctionalGroup,
    operations: { create: true, update: true, delete: true },
    dtoSchema: InstrumentFunctionalGroupListDtoSchema,
    hydrate: dto => xInstrumentFunctionalGroup.getClientModel(dto, "view"),
});

export const instrumentTagEditorView = defineCrudView({
    viewID: "InstrumentTag_Editor",
    entity: xInstrumentTag,
    operations: { create: true, update: true, delete: true },
    dtoSchema: InstrumentTagDtoSchema,
    hydrate: dto => xInstrumentTag.getClientModel(dto, "view"),
});

export const instrumentEditorView = defineCrudView({
    viewID: "Instrument_Editor",
    entity: xInstrument,
    operations: { create: true, update: true, delete: true },
    selection: instrumentEditorSelection,
    dtoSchema: InstrumentEditorDtoSchema,
    hydrate: dto => xInstrument.getClientModel(dto, "view"),
});

export type InstrumentFunctionalGroupListItem = ClientOf<typeof instrumentFunctionalGroupListView>;
export type InstrumentFunctionalGroupDashboardDto = DtoOf<typeof instrumentFunctionalGroupDashboardView>;
export type InstrumentDashboardDto = DtoOf<typeof instrumentDashboardView>;
export type InstrumentDashboardClient = ClientOf<typeof instrumentDashboardView>;
