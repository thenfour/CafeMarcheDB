import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import type { BandRolePublicId } from "shared/publicId";
import { assignableBandRoleWhere } from "src/auth/shared/bandRolePolicy";
import { validateRolePermissionWrite } from "src/auth/shared/rolePermissionPolicy";
import { DB3FieldReadAuth, defineAuthMap, defineTable, makeColumnSet, prismaModel } from "../../db3core";
import { LocalizedStringField, localizedText } from "../../columnTypes/localizedString";
import { BoolField, MakeColorField, MakeIsDeletedField, MakePKfield, MakePublicIdField, MakeSortOrderField, tagsRef } from "../../columnTypes/xTableColumnTypes";
import { serverOwnedField } from "../../columnTypes/inherited";
import { defineView, type DtoOf } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { kReadOnlyAuthMap } from "../common/entityCommon";

const selection = Prisma.validator<Prisma.BandRoleDefaultArgs>()({
    select: {
        publicId: true,
        name: true,
        description: true,
        color: true,
        sortOrder: true,
    },
});

export const roleMetadataAuth = defineAuthMap({
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreMutateAsOwner: Permission.sysadmin,
});
export const roleGrantsAuth = defineAuthMap({
    PostQuery: Permission.sysadmin,
    PostQueryAsOwner: Permission.sysadmin,
    PreInsert: Permission.sysadmin,
    PreMutate: Permission.sysadmin,
    PreMutateAsOwner: Permission.sysadmin,
});

/** Shared definitions are platform-owned; membership assignments remain band-owned. */
export const xBandRole = defineTable({
    tableName: "bandRole",
    tableUniqueName: "BandRole",
    prismaModel: prismaModel<Prisma.BandRoleDelegate>(),
    getIdentity: (role: { publicId: BandRolePublicId }) => role.publicId,
    queryStrategy: "resolved",
    deletePolicy: "disabled",
    tableAuthMap: {
        View: Permission.login,
        ViewOwn: Permission.login,
        Edit: Permission.sysadmin,
        EditOwn: Permission.sysadmin,
        Insert: Permission.sysadmin,
    },
    queryParameters: {},
    getParameterizedWhereClause: (): Prisma.BandRoleWhereInput[] => [{ isDeleted: false }],
    naturalOrderBy: { sortOrder: "asc", name: "asc" },
    getSelectionArgs: () => selection,
    getRowInfo: row => ({
        pk: row.publicId,
        name: localizedText(row.name) ?? "",
        ownerUserId: null,
    }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<BandRolePublicId>(),
        name: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "nameId", stringFormat: "PlainText", writeScope: "global", authMap: roleMetadataAuth }),
        description: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "descriptionId", stringFormat: "Markdown", writeScope: "global", authMap: roleMetadataAuth }),
        color: () => MakeColorField({ authMap: roleMetadataAuth }),
        sortOrder: () => MakeSortOrderField({ authMap: roleMetadataAuth }),
        isDeleted: () => serverOwnedField(MakeIsDeletedField({ authMap: kReadOnlyAuthMap })),
        isRoleForNewUsers: columnName => serverOwnedField(new BoolField({ columnName, allowNull: false, defaultValue: false, authMap: kReadOnlyAuthMap })),
        isPublicRole: columnName => serverOwnedField(new BoolField({ columnName, allowNull: false, defaultValue: false, authMap: kReadOnlyAuthMap })),
        bandRolePermissions: tagsRef("BandRolePermission",
            "Permission", {
            associationLocalObjectMember: "bandRole",
            associationForeignObjectMember: "permission",
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: () => false,
            authMap: roleGrantsAuth,
            validateWrite: context => validateRolePermissionWrite("band", context),
        }),
    }),
});

const contract = deriveViewContract(xBandRole, selection);

export const bandRoleListView = defineView({
    viewID: "BandRole_List",
    entity: xBandRole,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
});

export const bandRoleChoicesView = defineView({
    viewID: "BandRole_Choices",
    entity: xBandRole,
    selection: contract.prismaSelection,
    dtoSchema: contract.dtoSchema,
    hydrate: contract.hydrate,
    where: ({ auth }) => {
        auth.requireBand();
        auth.requirePermission(Permission.assign_user_roles);
        return assignableBandRoleWhere(auth);
    },
});

export type BandRoleDto = DtoOf<typeof bandRoleListView>;

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        BandRole: typeof xBandRole;
    }
}
