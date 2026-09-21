import { z } from "zod";
import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { isPublicId, type InstrumentFunctionalGroupPublicId } from "shared/publicId";
import { defineEntity } from "../../core/db3Entity";
import { defineCrudView, defineLegacyCrudView } from "../../core/db3CrudView";
import { type ClientOf, type DtoOf, defineView } from "../../core/db3View";
import { xInstrument, xInstrumentFunctionalGroup, xInstrumentTag } from "../../schema/instrument";
import {
    type InstrumentClientPayload,
    type InstrumentFunctionalGroupClientPayload,
    InstrumentTagAssociationNaturalOrderBy,
} from "../../schema/prismArgs";

const InstrumentFunctionalGroupPublicIdSchema = z.custom<InstrumentFunctionalGroupPublicId>(
    (value): value is InstrumentFunctionalGroupPublicId => isPublicId(value),
    "Expected an InstrumentFunctionalGroup public ID.",
);

export const instrumentFunctionalGroupEntity = defineEntity<Prisma.InstrumentFunctionalGroupDelegate>()({
    schema: xInstrumentFunctionalGroup,
    getIdentity: (entity: InstrumentFunctionalGroupClientPayload) => entity.publicId,
});

export const instrumentTagEntity = defineEntity<Prisma.InstrumentTagDelegate>()({
    schema: xInstrumentTag,
    getIdentity: (entity: Prisma.InstrumentTagGetPayload<{}>) => entity.id,
});

export const instrumentEntity = defineEntity<Prisma.InstrumentDelegate>()({
    schema: xInstrument,
    getIdentity: (entity: InstrumentClientPayload) => entity.id,
});

// The list view deliberately makes non-identity fields optional. Its selection
// is the maximum requested shape; per-field authorization may omit any of them.
const InstrumentFunctionalGroupListDtoSchema = z.object({
    publicId: InstrumentFunctionalGroupPublicIdSchema,
    name: z.string().optional(),
    description: z.string().optional(),
    sortOrder: z.number().int().optional(),
    color: z.string().nullable().optional(),
});

const InstrumentFunctionalGroupDashboardDtoSchema = z.object({
    publicId: InstrumentFunctionalGroupPublicIdSchema,
    name: z.string(),
    description: z.string(),
    sortOrder: z.number().int(),
    color: z.string().nullable(),
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

const DashboardInstrumentDtoSchema = z.object({
    id: z.number().int(),
    name: z.string(),
    description: z.string(),
    autoAssignFileLeafRegex: z.string().nullable(),
    sortOrder: z.number().int(),
    functionalGroupId: InstrumentFunctionalGroupPublicIdSchema,
    instrumentTags: z.array(z.object({
        id: z.number().int(),
        instrumentId: z.number().int(),
        tagId: z.number().int(),
    })),
});

export const instrumentFunctionalGroupListView = defineView({
    viewID: "InstrumentFunctionalGroup_List",
    entity: instrumentFunctionalGroupEntity,
    dtoSchema: InstrumentFunctionalGroupListDtoSchema,
    hydrate: dto => dto,
});

export const instrumentFunctionalGroupEditorView = defineCrudView({
    viewID: "InstrumentFunctionalGroup_Editor",
    entity: instrumentFunctionalGroupEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: InstrumentFunctionalGroupListDtoSchema,
    hydrate: dto => xInstrumentFunctionalGroup.getClientModel(dto, "view"),
});

export const instrumentFunctionalGroupDashboardView = defineView({
    viewID: "InstrumentFunctionalGroup_Dashboard",
    entity: instrumentFunctionalGroupEntity,
    dtoSchema: InstrumentFunctionalGroupDashboardDtoSchema,
    hydrate: dto => dto,
});

export const instrumentTagEditorView = defineLegacyCrudView({
    viewID: "InstrumentTag_Editor",
    entity: instrumentTagEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: InstrumentTagDtoSchema,
    hydrate: dto => dto,
});

export const instrumentEditorView = defineLegacyCrudView({
    viewID: "Instrument_Editor",
    entity: instrumentEntity,
    operations: { create: true, update: true, delete: true },
    selection: instrumentEditorSelection,
    dtoSchema: InstrumentEditorDtoSchema,
    hydrate: dto => dto,
});

export const instrumentDashboardView = defineView({
    viewID: "Instrument_Dashboard",
    entity: instrumentEntity,
    dtoSchema: DashboardInstrumentDtoSchema,
    hydrate: (dto, references) => ({
        ...dto,
        functionalGroup: references.require(
            instrumentFunctionalGroupEntity,
            dto.functionalGroupId,
            `Instrument(${dto.id}).functionalGroupId`,
        ),
        instrumentTags: dto.instrumentTags.map((association, index) => ({
            ...association,
            tag: references.require(
                instrumentTagEntity,
                association.tagId,
                `Instrument(${dto.id}).instrumentTags[${index}].tagId`,
            ),
        })).sort((a, b) => a.tag.sortOrder - b.tag.sortOrder),
    }),
});

export type InstrumentFunctionalGroupListItem = ClientOf<typeof instrumentFunctionalGroupListView>;
export type InstrumentFunctionalGroupDashboardDto = DtoOf<typeof instrumentFunctionalGroupDashboardView>;
export type InstrumentDashboardDto = DtoOf<typeof instrumentDashboardView>;
export type InstrumentDashboardClient = ClientOf<typeof instrumentDashboardView>;
