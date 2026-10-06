import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { isPublicId, parsePublicId } from "shared/publicId";
import type { StringResolution } from "src/locale/shared/stringResolution";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { DynamicStringIdentitySchema, LocalizedFieldEditSchema } from "src/locale/shared/dynamicStringWrite";
import { LocalizedStringField } from "../../columnTypes/localizedString";
import { GenericIntegerField, MakeSortOrderField } from "../../columnTypes/genericInteger";
import { GenericStringField } from "../../columnTypes/genericString";
import { foreignRef, MakePKfield, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { defineAuthMap, defineTable, DB3FieldReadAuth, makeColumnSet, prismaModel } from "../../db3core";
import { defineCommand } from "../../core/db3Command";
import { defineView, type DtoOf } from "../../core/db3View";
import { defineReferenceContract, reference, requireReference } from "../../core/db3Hydration";

const PublicId = z.string().refine(isPublicId, "Expected a public ID");

export const InstrumentIdentity = PublicId.transform(value => parsePublicId<"Instrument">(value));
export const GroupIdentity = PublicId.transform(value => parsePublicId<"InstrumentFunctionalGroup">(value));
const StringIdentity = DynamicStringIdentitySchema;

// auth is performed not in db3 but in custom commands
const authMap = defineAuthMap({
    // can read row = all columns visible (no per-column elision)
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    // cannot insert or mutate rows via db3; these are mutated via custom commands
    PreInsert: Permission.never_grant,
    PreMutate: Permission.never_grant,
    PreMutateAsOwner: Permission.never_grant,
});
const tableAuthMap = {
    View: Permission.login,
    ViewOwn: Permission.login,
    Insert: Permission.never_grant,
    Edit: Permission.never_grant,
    EditOwn: Permission.never_grant,
};

//
const localizedFields = () => makeColumnSet({
    id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
    name: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "nameId", stringFormat: "PlainText", authMap }),
    description: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "descriptionId", stringFormat: "Markdown", authMap }),
    sortOrder: () => MakeSortOrderField({ authMap }),
});

export const xBandInstrumentFunctionalGroup = defineTable({
    tableName: "BandInstrumentFunctionalGroup",
    prismaModel: prismaModel<Prisma.BandInstrumentFunctionalGroupDelegate>(),
    getIdentity: (row: { publicId: z.infer<typeof GroupIdentity> }) => row.publicId,
    deletePolicy: "disabled",
    tableAuthMap,
    getSelectionArgs: () => ({}),
    queryParameters: {},
    getParameterizedWhereClause: (_params, auth) => [{ bandId: auth.requireBand().id }],
    getRowInfo: row => ({
        pk: row.publicId,
        name: row.name ?? "",
        description: row.description,
        ownerUserId: null,
    }),
    fields: {
        ...localizedFields(),
        publicId: MakePublicIdField<z.infer<typeof GroupIdentity>>(),
        color: new GenericStringField({ columnName: "color", allowNull: true, format: "raw", authMap })
    },
});

export const xBandInstrument = defineTable({
    tableName: "BandInstrument",
    prismaModel: prismaModel<Prisma.BandInstrumentDelegate>(),
    getIdentity: (row: { publicId: z.infer<typeof InstrumentIdentity> }) => row.publicId,
    deletePolicy: "disabled",
    tableAuthMap,
    getSelectionArgs: () => ({}),
    queryParameters: {},
    getParameterizedWhereClause: (_params, auth) => [{ bandId: auth.requireBand().id }],
    getRowInfo: row => ({
        pk: row.publicId,
        name: row.name ?? "",
        description: row.description,
        ownerUserId: null,
    }),
    fields: {
        ...localizedFields(),
        publicId: MakePublicIdField<z.infer<typeof InstrumentIdentity>>(),
        ...makeColumnSet({
            functionalGroup: foreignRef(() => xBandInstrumentFunctionalGroup, { fkidMember: "functionalGroupId", authMap })
        })
    },
});

// The resolver owns the detailed union; the schema validates its public transport shape.
export const StringResolutionSchema: z.ZodType<StringResolution> = z.object({
    value: z.string().nullable(), localeTag: z.string().nullable(), scope: z.enum(["band", "global"]).nullable(),
    source: z.enum(["stored", "registry", "missing"]),
    reason: z.enum(["exact", "language", "system", "any", "registry-default", "unavailable-override", "missing"]),
    requestedTag: z.string().nullable(),
});

const localizedDto = {
    name: z.string().nullable(), description: z.string().nullable(), sortOrder: z.number().int(), isHidden: z.boolean(),
    sortOrderOverride: z.number().int().nullable(),
    nameStringPublicId: StringIdentity.nullable(), descriptionStringPublicId: StringIdentity.nullable(),
    nameResolution: StringResolutionSchema, descriptionResolution: StringResolutionSchema,
};

const groupDto = z.object({
    ...localizedDto,
    publicId: GroupIdentity,
    color: z.string().nullable(),
    colorOverride: z.string().nullable(),
    globalPublicId: PublicId.nullable(),
});

export const bandInstrumentGroupView = defineView({
    viewID: "BandInstrumentFunctionalGroup_Catalog", entity: xBandInstrumentFunctionalGroup,
    // Localized DTO fields are computed; the catalog reader supplies the authorized raw selection.
    selection: {},
    dtoSchema: groupDto,
    hydrate: dto => dto,
});
export const bandInstrumentReferences = defineReferenceContract({
    functionalGroup: reference(xBandInstrumentFunctionalGroup)<DtoOf<typeof bandInstrumentGroupView>>(),
});
export const bandInstrumentView = defineView({
    viewID: "BandInstrument_Catalog", entity: xBandInstrument, references: bandInstrumentReferences,
    selection: {},
    dtoSchema: z.object({
        ...localizedDto,
        publicId: InstrumentIdentity,
        functionalGroupId: GroupIdentity,
        globalPublicId: PublicId.nullable(),
        autoAssignFileLeafRegex: z.string().nullable(),
        autoAssignFileLeafRegexOverride: z.string().nullable()
    }),
    hydrate: (dto, references) => ({
        ...dto,
        functionalGroup: requireReference(references, xBandInstrumentFunctionalGroup, dto.functionalGroupId, "instrument.functionalGroup")
    }),
});
export type BandInstrumentDto = DtoOf<typeof bandInstrumentView>;
export type BandInstrumentGroupDto = DtoOf<typeof bandInstrumentGroupView>;

export const BandInstrumentQuerySchema = z.object({
    bandPublicId: BandPublicIdSchema,
    routeLocale: z.string().max(128).nullish(),
    browserLanguages: z.array(z.string().max(128)).max(32).optional(),
    includeHidden: z.boolean().optional(),
}).strict();
export type BandInstrumentQuery = z.infer<typeof BandInstrumentQuerySchema>;

const textFields = {
    name: LocalizedFieldEditSchema.optional(),
    description: LocalizedFieldEditSchema.optional(),
};
const sortOrder = z.number().int().min(-1_000_000).max(1_000_000).nullable();

const instrumentPatch = z.object({
    ...textFields, functionalGroupId: GroupIdentity.optional(),
    sortOrder: sortOrder.optional(),
    isHidden: z.boolean().optional(),
    autoAssignFileLeafRegex: z.string().max(768).nullable().optional()
}).strict()
    .refine(patch => Object.values(patch).length > 0 && Object.values(patch).every(value => value !== undefined), "Supply explicit changed fields.");

const groupPatch = z.object({
    ...textFields,
    color: z.string().max(128).nullable().optional(),
    sortOrder: sortOrder.optional(),
    isHidden: z.boolean().optional()
}).strict()
    .refine(patch => Object.values(patch).length > 0 && Object.values(patch).every(value => value !== undefined), "Supply explicit changed fields.");

const commandSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("createInstrument"), functionalGroupId: GroupIdentity, localeTag: z.string().min(1).max(128),
        name: z.string().max(768), description: z.string().max(1_000_000), sortOrder, autoAssignFileLeafRegex: z.string().max(768).nullable()
    }).strict(),
    z.object({
        kind: z.literal("createGroup"), localeTag: z.string().min(1).max(128), name: z.string().max(768),
        description: z.string().max(1_000_000), color: z.string().max(128).nullable(), sortOrder
    }).strict(),
    z.object({ kind: z.literal("optInInstrument"), globalPublicId: PublicId }).strict(),
    z.object({ kind: z.literal("optInGroup"), globalPublicId: PublicId }).strict(),
    z.object({ kind: z.literal("updateInstrument"), publicId: InstrumentIdentity, patch: instrumentPatch }).strict(),
    z.object({ kind: z.literal("updateGroup"), publicId: GroupIdentity, patch: groupPatch }).strict(),
]);


export type BandInstrumentCommand = z.infer<typeof commandSchema>;

export const bandInstrumentCommand = defineCommand({
    commandID: "BandInstrument_Edit",
    entity: xBandInstrument,
    dtoSchema: commandSchema,
    resultSchema: z.object({ publicId: PublicId }).strict(),
    serialize: (input: BandInstrumentCommand) => input,
    invalidation: {
        mode: "caller",
        entityIDs: [xBandInstrument.tableID, xBandInstrumentFunctionalGroup.tableID],
    },
});
