import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import { SongTagPublicId, type PublicId } from "shared/publicId";
import { bandCatalogAuth, bandCatalogFields, bandCatalogCreateFromString, catalogColor, catalogDisplayModel } from "../../columnTypes/bandCatalog";
import { MakeColorField } from "../../columnTypes/color";
import { CatalogSourceField, inheritedField } from "../../columnTypes/inherited";
import { GenericStringField } from "../../columnTypes/genericString";
import { localizedText } from "../../columnTypes/localizedString";
import { MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { defineTable, prismaModel, makeColumnSet } from "../../db3core";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";

const { authMap, sourceAuthMap, tableAuthMap } = bandCatalogAuth(BandPermission.admin_songs);
const colorField = inheritedField(MakeColorField({ authMap }));
export const bandSongTagSelection = Prisma.validator<Prisma.BandSongTagDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
        isHidden: true,
        group: true,
        indicator: true,
        indicatorCssClass: true,
        globalSongTag: true,
    }
});
export const xBandSongTag = defineTable({
    tableName: "bandSongTag",
    tableUniqueName: "BandSongTag",
    prismaModel: prismaModel<Prisma.BandSongTagDelegate>(),
    getIdentity: (row: { publicId: PublicId<"SongTag"> }) => row.publicId,
    deletePolicy: "disabled",
    tableAuthMap,
    queryStrategy: "resolved",
    bandScope: {
        member: "bandId",
        inheritedFrom: "globalSongTag",
        inheritedSourceMember: "globalSongTagId",
        hiddenMember: "isHidden",
        managePermission: BandPermission.admin_songs,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => bandSongTagSelection,
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
        publicId: MakePublicIdField<SongTagPublicId>(),
        color: colorField,
        globalSongTag: new CatalogSourceField({ columnName: "globalSongTag", sourceTable: "globalSongTag", authMap: sourceAuthMap }),
        ...makeColumnSet({
            group: columnName => inheritedField(new GenericStringField({ columnName, allowNull: true, format: "raw", maxLength: 768, authMap })),
            indicator: columnName => inheritedField(new GenericStringField({ columnName, allowNull: true, format: "raw", maxLength: 191, authMap })),
            indicatorCssClass: columnName => inheritedField(new GenericStringField({ columnName, allowNull: true, format: "raw", maxLength: 191, authMap })),
        }),
    },
});

export const bandSongTagContract = deriveViewContract(xBandSongTag, bandSongTagSelection);
export const bandSongTagDisplayContract = {
    ...bandSongTagContract,
    hydrate: (...args: Parameters<typeof bandSongTagContract.hydrate>) =>
        catalogDisplayModel(bandSongTagContract.hydrate(...args)),
};

export const bandSongTagView = defineCrudView({
    viewID: "BandSongTag_Catalog",
    entity: xBandSongTag,
    operations: { create: true, update: true },
    selection: bandSongTagContract.prismaSelection,
    dtoSchema: bandSongTagContract.dtoSchema,
    hydrate: bandSongTagContract.hydrate,
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandSongTag: typeof xBandSongTag;
    }
}
