import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { EventTagPublicId, type GlobalEventTagPublicId, type PublicId } from "shared/publicId";
import { bandCatalogAuth, bandCatalogFields, bandCatalogCreateFromString, catalogColor, catalogDisplayModel } from "../../columnTypes/bandCatalog";
import { MakeColorField } from "../../columnTypes/color";
import { CatalogSourceField, inheritedField } from "../../columnTypes/inherited";
import { LocalizedStringField, localizedText } from "../../columnTypes/localizedString";
import { BoolField, MakePKfield, MakePublicIdField, MakeSortOrderField } from "../../columnTypes/xTableColumnTypes";
import { DB3FieldReadAuth, defineAuthMap, defineTable, prismaModel } from "../../db3core";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";

const { authMap, sourceAuthMap, tableAuthMap } = bandCatalogAuth(BandPermission.admin_events);
const colorField = inheritedField(MakeColorField({ authMap }));

class EventTagSourceField extends CatalogSourceField<{ authMap: typeof sourceAuthMap }> {
    readonly readCompanionSchemas = {
        globalPublicId: z.string().nullable(),
        visibleOnFrontpage: z.boolean(),
    };

    // Catalog source selections have heterogeneous scalar members at this boundary.
    // (i.e. not nested objects)
    resolveSourceReadCompanions(source: Readonly<Record<string, unknown>> | null) {
        return {
            ...super.resolveSourceReadCompanions(source),
            visibleOnFrontpage: source?.visibleOnFrontpage === true
        };
    }
}
export const bandEventTagSelection = Prisma.validator<Prisma.BandEventTagDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
        isHidden: true,
        globalEventTag: true,
    }
});
export const xBandEventTag = defineTable({
    tableName: "bandEventTag",
    tableUniqueName: "BandEventTag",
    prismaModel: prismaModel<Prisma.BandEventTagDelegate>(),
    getIdentity: (row: { publicId: PublicId<"EventTag"> }) => row.publicId,
    deletePolicy: "hard",
    tableAuthMap,
    queryStrategy: "resolved",
    bandScope: {
        member: "bandId",
        inheritedFrom: "globalEventTag",
        inheritedSourceMember: "globalEventTagId",
        hiddenMember: "isHidden",
        managePermission: BandPermission.admin_events,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    // Internal row authorization needs ownership; public views keep bandId server-owned.
    getSelectionArgs: () => ({ select: { ...bandEventTagSelection.select, bandId: true } }),
    createInsertModelFromString: bandCatalogCreateFromString,
    queryParameters: { includeHidden: { kind: "boolean", authorizeAs: "isHidden" } },
    getRowInfo: row => ({
        pk: row.publicId, name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? undefined,
        color: catalogColor(row.color, colorField.valueField.palette),
        ownerUserId: null
    }),
    fields: {
        ...bandCatalogFields({ authMap }),
        publicId: MakePublicIdField<EventTagPublicId>(),
        color: colorField,
        globalEventTag: new EventTagSourceField({ columnName: "globalEventTag", sourceTable: "globalEventTag", authMap: sourceAuthMap }),
    },
});

export const bandEventTagContract = deriveViewContract(xBandEventTag, bandEventTagSelection);
export const bandEventTagDisplayContract = {
    ...bandEventTagContract,
    hydrate: (...args: Parameters<typeof bandEventTagContract.hydrate>) =>
        catalogDisplayModel(bandEventTagContract.hydrate(...args)),
};

export const bandEventTagView = defineCrudView({
    viewID: "BandEventTag_Catalog",
    entity: xBandEventTag,
    operations: { create: true, update: true, delete: true },
    selection: bandEventTagContract.prismaSelection,
    dtoSchema: bandEventTagContract.dtoSchema,
    hydrate: bandEventTagContract.hydrate,
});

const globalAuthMap = defineAuthMap({
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.manage_global_catalogs,
    PreMutate: Permission.manage_global_catalogs,
    PreMutateAsOwner: Permission.manage_global_catalogs,
});

const globalColorField = MakeColorField({ authMap: globalAuthMap });

export const globalEventTagSelection = Prisma.validator<Prisma.GlobalEventTagDefaultArgs>()({
    select: { publicId: true, name: true, description: true, color: true, sortOrder: true, visibleOnFrontpage: true },
});

export const xGlobalEventTag = defineTable({
    tableName: "globalEventTag",
    tableUniqueName: "GlobalEventTag",
    prismaModel: prismaModel<Prisma.GlobalEventTagDelegate>(),
    getIdentity: (row: { publicId: GlobalEventTagPublicId }) => row.publicId,
    // Shared tags in use are protected by BandEventTag's restrictive foreign key.
    deletePolicy: "hard",
    queryStrategy: "resolved",
    tableAuthMap: {
        View: Permission.public, ViewOwn: Permission.public,
        Insert: Permission.manage_global_catalogs, Edit: Permission.manage_global_catalogs, EditOwn: Permission.manage_global_catalogs,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => globalEventTagSelection,
    createInsertModelFromString: (input, context) => {
        if (!context?.localeTag) {
            throw new Error("A writing locale is required to create a global event tag.");
        }
        return {
            ...bandCatalogCreateFromString(input, context),
            description: { kind: "set", stringPublicId: null, localeTag: context.localeTag, value: "" },
        };
    },
    getRowInfo: row => ({
        pk: row.publicId, name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? undefined,
        color: catalogColor(row.color, globalColorField.palette), ownerUserId: null,
    }),
    fields: {
        id: MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: MakePublicIdField<GlobalEventTagPublicId>(),
        name: new LocalizedStringField({ columnName: "name", stringIdentityMember: "nameId", stringFormat: "PlainText", writeScope: "global", authMap: globalAuthMap }),
        description: new LocalizedStringField({ columnName: "description", stringIdentityMember: "descriptionId", stringFormat: "Markdown", writeScope: "global", authMap: globalAuthMap }),
        color: globalColorField,
        sortOrder: MakeSortOrderField({ authMap: globalAuthMap }),
        visibleOnFrontpage: new BoolField({ columnName: "visibleOnFrontpage", defaultValue: false, allowNull: false, authMap: globalAuthMap }),
    },
});

export const globalEventTagContract = deriveViewContract(xGlobalEventTag, globalEventTagSelection);

export const globalEventTagView = defineCrudView({
    viewID: "GlobalEventTag_Catalog", entity: xGlobalEventTag,
    operations: { create: true, update: true, delete: true },
    selection: globalEventTagContract.prismaSelection,
    dtoSchema: globalEventTagContract.dtoSchema,
    hydrate: globalEventTagContract.hydrate,
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandEventTag: typeof xBandEventTag;
        GlobalEventTag: typeof xGlobalEventTag;
    }
}
