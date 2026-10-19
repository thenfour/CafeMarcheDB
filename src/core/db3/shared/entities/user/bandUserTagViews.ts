import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import type { UserTagPublicId } from "shared/publicId";
import { bandCatalogAuth, bandCatalogFields, bandCatalogCreateFromString, catalogColor, catalogDisplayModel } from "../../columnTypes/bandCatalog";
import { MakeColorField } from "../../columnTypes/color";
import { CatalogSourceField, inheritedField } from "../../columnTypes/inherited";
import { GenericStringField } from "../../columnTypes/genericString";
import { localizedText } from "../../columnTypes/localizedString";
import { ForeignCollectionField, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { defineTable, prismaModel, makeColumnSet } from "../../db3core";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import { kReadOnlyAuthMap } from "../common/entityCommon";

const { authMap, sourceAuthMap, tableAuthMap } = bandCatalogAuth(BandPermission.manage_user_taxonomy);
const colorField = inheritedField(MakeColorField({ authMap }));

export const bandUserTagSelection = Prisma.validator<Prisma.BandUserTagDefaultArgs>()({
    select: {
        publicId: true, name: true, description: true, color: true,
        sortOrder: true, isHidden: true, cssClass: true, significance: true, globalUserTag: true,
    },
});

export const xBandUserTag = defineTable({
    tableName: "bandUserTag", tableUniqueName: "BandUserTag",
    prismaModel: prismaModel<Prisma.BandUserTagDelegate>(),
    getIdentity: (row: { publicId: UserTagPublicId }) => row.publicId,
    deletePolicy: "disabled", tableAuthMap, queryStrategy: "resolved",
    bandScope: {
        member: "bandId", inheritedFrom: "globalUserTag", inheritedSourceMember: "globalUserTagId",
        hiddenMember: "isHidden", managePermission: BandPermission.manage_user_taxonomy,
    },
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => bandUserTagSelection,
    createInsertModelFromString: bandCatalogCreateFromString,
    queryParameters: {
        includeHidden: { kind: "boolean", authorizeAs: "isHidden" },
        ids: { kind: "entityIdentityArray", targetTableID: "BandUserTag", authorizeAs: "publicId" },
    },
    getParameterizedWhereClause: (params: { ids?: number[] }): Prisma.BandUserTagWhereInput[] =>
        params.ids === undefined ? [] : [{ id: { in: params.ids } }],
    getRowInfo: row => ({
        pk: row.publicId, name: localizedText(row.name) ?? "",
        description: localizedText(row.description) ?? undefined,
        color: catalogColor(row.color, colorField.valueField.palette), ownerUserId: null,
    }),
    fields: {
        ...bandCatalogFields({ authMap }),
        publicId: MakePublicIdField<UserTagPublicId>(),
        color: colorField,
        globalUserTag: new CatalogSourceField({ columnName: "globalUserTag", sourceTable: "globalUserTag", authMap: sourceAuthMap }),
        ...makeColumnSet({
            bandUserTagAssignments: memberName => new ForeignCollectionField({
                memberName, foreignTableID: "BandUserTagAssignment", authMap: kReadOnlyAuthMap,
            }),
            cssClass: columnName => inheritedField(new GenericStringField({ columnName, allowNull: true, format: "raw", maxLength: 191, authMap })),
            // Keep migrated invitation behavior intact until its separate behavioral cleanup.
            significance: columnName => inheritedField(new GenericStringField({
                columnName, allowNull: true, format: "raw", allowQuickFilter: false, authMap: kReadOnlyAuthMap,
            })),
        }),
    },
});

export const bandUserTagContract = deriveViewContract(xBandUserTag, bandUserTagSelection);
export const bandUserTagDisplayContract = {
    ...bandUserTagContract,
    hydrate: (...args: Parameters<typeof bandUserTagContract.hydrate>) =>
        catalogDisplayModel(bandUserTagContract.hydrate(...args)),
};

export const bandUserTagView = defineCrudView({
    viewID: "BandUserTag_Catalog", entity: xBandUserTag,
    operations: { create: true, update: true },
    selection: bandUserTagContract.prismaSelection,
    dtoSchema: bandUserTagContract.dtoSchema, hydrate: bandUserTagContract.hydrate,
});

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandUserTag: typeof xBandUserTag;
    }
}
