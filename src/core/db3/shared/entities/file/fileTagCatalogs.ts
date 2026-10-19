import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import type { FileTagPublicId, GlobalFileTagPublicId } from "shared/publicId";
import { bandCatalogAuth, bandCatalogFields, bandCatalogCreateFromString, catalogColor, catalogDisplayModel } from "../../columnTypes/bandCatalog";
import { MakeColorField } from "../../columnTypes/color";
import { CatalogSourceField, inheritedField } from "../../columnTypes/inherited";
import { LocalizedStringField, localizedText } from "../../columnTypes/localizedString";
import { MakePKfield, MakePublicIdField, MakeSignificanceField, MakeSortOrderField } from "../../columnTypes/xTableColumnTypes";
import { DB3FieldReadAuth, defineAuthMap, defineTable, prismaModel } from "../../db3core";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import { FileTagSignificance } from "../../schema/prismArgs";

const { authMap, sourceAuthMap, tableAuthMap } = bandCatalogAuth(BandPermission.admin_files);
const colorField = inheritedField(MakeColorField({ authMap }));

class FileTagSourceField extends CatalogSourceField<{ authMap: typeof sourceAuthMap }> {
    readonly readCompanionSchemas = {
        globalPublicId: z.string().nullable(),
        significance: z.string().nullable(),
    };

    // A catalog source contains heterogeneous scalar fields; expose only its behavior value.
    resolveSourceReadCompanions(source: Readonly<Record<string, unknown>> | null) {
        return {
            ...super.resolveSourceReadCompanions(source),
            significance: typeof source?.significance === "string" ? source.significance : null,
        };
    }
}

export const bandFileTagSelection = Prisma.validator<Prisma.BandFileTagDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
        isHidden: true,
        globalFileTag: true
    },
});

export const xBandFileTag = defineTable({
    tableName: "bandFileTag",
    tableUniqueName: "BandFileTag",
    prismaModel: prismaModel<Prisma.BandFileTagDelegate>(),
    getIdentity: (row: { publicId: FileTagPublicId }) => row.publicId,
    deletePolicy: "hard",
    tableAuthMap,
    queryStrategy: "resolved",
    bandScope: {
        member: "bandId",
        inheritedFrom: "globalFileTag",
        inheritedSourceMember: "globalFileTagId",
        hiddenMember: "isHidden",
        managePermission: BandPermission.admin_files,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => ({
        select: {
            ...bandFileTagSelection.select,
            bandId: true
        }
    }),
    createInsertModelFromString: bandCatalogCreateFromString,
    queryParameters: { includeHidden: { kind: "boolean", authorizeAs: "isHidden" } },
    getRowInfo: row => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? undefined,
        color: catalogColor(row.color, colorField.valueField.palette),
        ownerUserId: null,
    }),
    fields: {
        ...bandCatalogFields({ authMap }),
        publicId: MakePublicIdField<FileTagPublicId>(),
        color: colorField,
        globalFileTag: new FileTagSourceField({ columnName: "globalFileTag", sourceTable: "globalFileTag", authMap: sourceAuthMap }),
    },
});

export const bandFileTagContract = deriveViewContract(xBandFileTag, bandFileTagSelection);
export const bandFileTagDisplayContract = {
    ...bandFileTagContract,
    hydrate: (...args: Parameters<typeof bandFileTagContract.hydrate>) => catalogDisplayModel(bandFileTagContract.hydrate(...args)),
};
export const bandFileTagView = defineCrudView({
    viewID: "BandFileTag_Catalog",
    entity: xBandFileTag,
    operations: { create: true, update: true, delete: true },
    selection: bandFileTagContract.prismaSelection,
    dtoSchema: bandFileTagContract.dtoSchema,
    hydrate: bandFileTagContract.hydrate,
});

const globalAuthMap = defineAuthMap({
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.manage_global_catalogs,
    PreMutate: Permission.manage_global_catalogs,
    PreMutateAsOwner: Permission.manage_global_catalogs,
});

const globalColorField = MakeColorField({ authMap: globalAuthMap });

export const globalFileTagSelection = Prisma.validator<Prisma.GlobalFileTagDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true
    },
});

export const xGlobalFileTag = defineTable({
    tableName: "globalFileTag",
    tableUniqueName: "GlobalFileTag",
    prismaModel: prismaModel<Prisma.GlobalFileTagDelegate>(),
    getIdentity: (row: { publicId: GlobalFileTagPublicId }) => row.publicId,
    // Band tags in use protect the shared default through its restrictive foreign key.
    deletePolicy: "hard",
    queryStrategy: "resolved",
    tableAuthMap: {
        View: Permission.public,
        ViewOwn: Permission.public,
        Insert: Permission.manage_global_catalogs,
        Edit: Permission.manage_global_catalogs,
        EditOwn: Permission.manage_global_catalogs,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => globalFileTagSelection,
    createInsertModelFromString: (input, context) => {
        if (!context?.localeTag) {
            throw new Error("A writing locale is required to create a global file tag.");
        }
        return {
            ...bandCatalogCreateFromString(input, context),
            description: { kind: "set", stringPublicId: null, localeTag: context.localeTag, value: "" },
        };
    },
    getRowInfo: row => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? undefined,
        color: catalogColor(row.color, globalColorField.palette),
        ownerUserId: null,
    }),
    fields: {
        id: MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: MakePublicIdField<GlobalFileTagPublicId>(),
        name: new LocalizedStringField({ columnName: "name", stringIdentityMember: "nameId", stringFormat: "PlainText", writeScope: "global", authMap: globalAuthMap }),
        description: new LocalizedStringField({ columnName: "description", stringIdentityMember: "descriptionId", stringFormat: "Markdown", writeScope: "global", authMap: globalAuthMap }),
        color: globalColorField,
        sortOrder: MakeSortOrderField({ authMap: globalAuthMap }),
        significance: MakeSignificanceField("significance", FileTagSignificance, { authMap: globalAuthMap }),
    },
});


export const globalFileTagContract = deriveViewContract(xGlobalFileTag, globalFileTagSelection);

export const globalFileTagView = defineCrudView({
    viewID: "GlobalFileTag_Catalog",
    entity: xGlobalFileTag,
    operations: { create: true, update: true, delete: true },
    selection: globalFileTagContract.prismaSelection,
    dtoSchema: globalFileTagContract.dtoSchema,
    hydrate: globalFileTagContract.hydrate,
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandFileTag: typeof xBandFileTag;
        GlobalFileTag: typeof xGlobalFileTag;
    }
}
