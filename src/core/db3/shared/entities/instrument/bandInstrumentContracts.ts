import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { isPublicId, parsePublicId } from "shared/publicId";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { localizedText } from "../../columnTypes/localizedString";
import { bandCatalogAuth, bandCatalogFields, bandCatalogCreateFromString, catalogColor, catalogDisplayModel } from "../../columnTypes/bandCatalog";
import { GenericStringField } from "../../columnTypes/genericString";
import { MakeColorField } from "../../columnTypes/color";
import { inheritedField, CatalogSourceField } from "../../columnTypes/inherited";
import { foreignRef, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { defineTable, makeColumnSet, prismaModel } from "../../db3core";
import { defineCommand } from "../../core/db3Command";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import { type DtoOf } from "../../core/db3View";
import { defineReferenceContract, reference } from "../../core/db3Hydration";

const PublicId = z.string().refine(isPublicId, "Expected a public ID");
export const InstrumentIdentity = PublicId.transform(value => parsePublicId<"Instrument">(value));
export const GroupIdentity = PublicId.transform(value => parsePublicId<"InstrumentFunctionalGroup">(value));

const { authMap, sourceAuthMap, tableAuthMap } = bandCatalogAuth(Permission.admin_instruments);
const groupColorField = inheritedField(MakeColorField({ authMap }));
const groupSelection = Prisma.validator<Prisma.BandInstrumentFunctionalGroupDefaultArgs>()({
    select: {
        publicId: true, name: true, description: true, sortOrder: true, color: true, isHidden: true, globalFunctionalGroup: true,
    }
});

const instrumentSelection = Prisma.validator<Prisma.BandInstrumentDefaultArgs>()({
    select: {
        publicId: true, name: true, description: true, sortOrder: true, isHidden: true, globalInstrument: true,
        autoAssignFileLeafRegex: true, functionalGroupId: true,
    }
});

export const xBandInstrumentFunctionalGroup = defineTable({
    tableName: "bandInstrumentFunctionalGroup",
    tableUniqueName: "BandInstrumentFunctionalGroup",
    prismaModel: prismaModel<Prisma.BandInstrumentFunctionalGroupDelegate>(),
    getIdentity: (row: { publicId: z.infer<typeof GroupIdentity> }) => row.publicId,
    deletePolicy: "disabled",
    tableAuthMap, queryStrategy: "resolved",
    bandScope: {
        member: "bandId",
        inheritedFrom: "globalFunctionalGroup",
        inheritedSourceMember: "globalFunctionalGroupId",
        hiddenMember: "isHidden",
        managePermission: Permission.admin_instruments,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => groupSelection,
    createInsertModelFromString: bandCatalogCreateFromString,
    queryParameters: { includeHidden: { kind: "boolean", authorizeAs: "isHidden" } },
    getRowInfo: row => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? undefined,
        color: catalogColor(row.color, groupColorField.valueField.palette),
        ownerUserId: null
    }),
    fields: {
        ...bandCatalogFields({ authMap }),
        publicId: MakePublicIdField<z.infer<typeof GroupIdentity>>(),
        color: groupColorField,
        globalFunctionalGroup: new CatalogSourceField({
            columnName: "globalFunctionalGroup",
            sourceTable: "globalInstrumentFunctionalGroup",
            authMap: sourceAuthMap
        }),
    },
});

export const xBandInstrument = defineTable({
    tableName: "bandInstrument",
    tableUniqueName: "BandInstrument",
    prismaModel: prismaModel<Prisma.BandInstrumentDelegate>(),
    getIdentity: (row: { publicId: z.infer<typeof InstrumentIdentity> }) => row.publicId,
    deletePolicy: "disabled",
    tableAuthMap, queryStrategy: "resolved",
    bandScope: {
        member: "bandId",
        inheritedFrom: "globalInstrument",
        inheritedSourceMember: "globalInstrumentId",
        hiddenMember: "isHidden",
        managePermission: Permission.admin_instruments,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => instrumentSelection,
    queryParameters: { includeHidden: { kind: "boolean", authorizeAs: "isHidden" } },
    getRowInfo: row => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? undefined,
        ownerUserId: null,
    }),
    fields: {
        ...bandCatalogFields({ authMap }),
        publicId: MakePublicIdField<z.infer<typeof InstrumentIdentity>>(),
        autoAssignFileLeafRegex: inheritedField(new GenericStringField({
            columnName: "autoAssignFileLeafRegex", allowNull: true,
            format: "regex", maxLength: 768, allowQuickFilter: false, authMap
        })),
        globalInstrument: new CatalogSourceField({ columnName: "globalInstrument", sourceTable: "globalInstrument", authMap: sourceAuthMap }),
        ...makeColumnSet({
            functionalGroup: foreignRef(() => xBandInstrumentFunctionalGroup,
                {
                    fkidMember: "functionalGroupId",
                    requireVisibleTarget: true,
                    allowInsertFromString: true,
                    authMap
                })
        }),
    },
});
export const bandInstrumentGroupContract = deriveViewContract(xBandInstrumentFunctionalGroup, groupSelection);
export const bandInstrumentGroupView = defineCrudView({
    viewID: "BandInstrumentFunctionalGroup_Catalog",
    entity: xBandInstrumentFunctionalGroup,
    operations: { create: true, update: true },
    selection: bandInstrumentGroupContract.prismaSelection,
    dtoSchema: bandInstrumentGroupContract.dtoSchema,
    hydrate: bandInstrumentGroupContract.hydrate,
});
export const bandInstrumentGroupDisplayContract = {
    ...bandInstrumentGroupContract,
    hydrate: (...args: Parameters<typeof bandInstrumentGroupContract.hydrate>) =>
        catalogDisplayModel(bandInstrumentGroupContract.hydrate(...args)),
};
export const bandInstrumentReferences = defineReferenceContract({
    instrumentFunctionalGroup: reference(xBandInstrumentFunctionalGroup)<ReturnType<typeof bandInstrumentGroupDisplayContract.hydrate>>(),
});
export const bandInstrumentContract = deriveViewContract(xBandInstrument, instrumentSelection, { references: bandInstrumentReferences });
export const bandInstrumentDisplayContract = {
    ...bandInstrumentContract,
    hydrate: (...args: Parameters<typeof bandInstrumentContract.hydrate>) =>
        catalogDisplayModel(bandInstrumentContract.hydrate(...args)),
};
export const bandInstrumentView = defineCrudView({
    viewID: "BandInstrument_Catalog",
    entity: xBandInstrument,
    references: bandInstrumentContract.referenceContract,
    operations: { create: true, update: true },
    selection: bandInstrumentContract.prismaSelection,
    dtoSchema: bandInstrumentContract.dtoSchema,
    hydrate: bandInstrumentContract.hydrate,
});
export type BandInstrumentDto = DtoOf<typeof bandInstrumentView>;
export type BandInstrumentGroupDto = DtoOf<typeof bandInstrumentGroupView>;

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandInstrument: typeof xBandInstrument;
        BandInstrumentFunctionalGroup: typeof xBandInstrumentFunctionalGroup;
    }
}

export const BandInstrumentQuerySchema = z.object({
    bandPublicId: BandPublicIdSchema,
    routeLocale: z.string().max(128).nullish(),
    browserLanguages: z.array(z.string().max(128)).max(32).optional(),
}).strict();
export type BandInstrumentQuery = z.infer<typeof BandInstrumentQuerySchema>;

const commandSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("optInInstrument"), globalPublicId: PublicId }).strict(),
    z.object({ kind: z.literal("optInGroup"), globalPublicId: PublicId }).strict(),
]);

export type BandInstrumentCommand = z.infer<typeof commandSchema>;

export const bandInstrumentCommand = defineCommand({
    commandID: "BandInstrument_OptIn",
    entity: xBandInstrument,
    dtoSchema: commandSchema,
    resultSchema: z.object({ publicId: PublicId }).strict(),
    serialize: (input: BandInstrumentCommand) => input,
    invalidation: {
        mode: "caller",
        entityIDs: [xBandInstrument.tableID, xBandInstrumentFunctionalGroup.tableID],
    },
});
