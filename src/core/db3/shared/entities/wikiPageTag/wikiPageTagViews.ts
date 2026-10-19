import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "db";
import type { WikiPageTagPublicId } from "shared/publicId";
import { bandCatalogAuth, bandCatalogFields, bandCatalogCreateFromString, catalogColor, catalogDisplayModel } from "../../columnTypes/bandCatalog";
import { MakeColorField } from "../../columnTypes/color";
import { CatalogSourceField, inheritedField } from "../../columnTypes/inherited";
import { localizedText } from "../../columnTypes/localizedString";
import { MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import { defineTable, prismaModel } from "../../db3core";

const { authMap, sourceAuthMap, tableAuthMap } = bandCatalogAuth(BandPermission.admin_wiki_pages);
const colorField = inheritedField(MakeColorField({ authMap }));

export const bandWikiPageTagSelection = Prisma.validator<Prisma.BandWikiPageTagDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
        isHidden: true,
        globalWikiPageTag: true,
    },
});

export const xBandWikiPageTag = defineTable({
    tableName: "bandWikiPageTag",
    tableUniqueName: "BandWikiPageTag",
    prismaModel: prismaModel<Prisma.BandWikiPageTagDelegate>(),
    getIdentity: (row: { publicId: WikiPageTagPublicId }) => row.publicId,
    deletePolicy: "hard",
    tableAuthMap,
    queryStrategy: "resolved",
    bandScope: {
        member: "bandId",
        inheritedFrom: "globalWikiPageTag",
        inheritedSourceMember: "globalWikiPageTagId",
        hiddenMember: "isHidden",
        managePermission: BandPermission.admin_wiki_pages,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    // Ownership is required for row authorization and stays outside public transport.
    getSelectionArgs: () => ({ select: { ...bandWikiPageTagSelection.select, bandId: true } }),
    createInsertModelFromString: bandCatalogCreateFromString,
    queryParameters: { includeHidden: { kind: "boolean", authorizeAs: "isHidden" } },
    getRowInfo: row => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? "",
        color: catalogColor(row.color, colorField.valueField.palette),
        ownerUserId: null,
    }),
    fields: {
        ...bandCatalogFields({ authMap }),
        publicId: MakePublicIdField<WikiPageTagPublicId>(),
        color: colorField,
        globalWikiPageTag: new CatalogSourceField({ columnName: "globalWikiPageTag", sourceTable: "globalWikiPageTag", authMap: sourceAuthMap }),
    },
});

export const bandWikiPageTagContract = deriveViewContract(xBandWikiPageTag, bandWikiPageTagSelection);
export const bandWikiPageTagDisplayContract = {
    ...bandWikiPageTagContract,
    hydrate: (...args: Parameters<typeof bandWikiPageTagContract.hydrate>) =>
        catalogDisplayModel(bandWikiPageTagContract.hydrate(...args)),
};

export const bandWikiPageTagView = defineCrudView({
    viewID: "BandWikiPageTag_Catalog",
    entity: xBandWikiPageTag,
    operations: { create: true, update: true, delete: true },
    selection: bandWikiPageTagContract.prismaSelection,
    dtoSchema: bandWikiPageTagContract.dtoSchema,
    hydrate: bandWikiPageTagContract.hydrate,
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandWikiPageTag: typeof xBandWikiPageTag;
    }
}
