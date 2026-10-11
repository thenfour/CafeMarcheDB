import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
import type { GlobalRolePublicId, GlobalRolePermissionPublicId, BandRolePermissionPublicId } from "shared/publicId";
import { validateRolePermissionWrite } from "src/auth/shared/rolePermissionPolicy";
import { serverOwnedField } from "../../columnTypes/inherited";
import { LocalizedStringField, localizedText } from "../../columnTypes/localizedString";
import { BoolField, MakeColorField, MakeIsDeletedField, MakePKfield, MakePublicIdField, MakeSortOrderField, foreignRef, tagsRef } from "../../columnTypes/xTableColumnTypes";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { deriveViewContract } from "../../core/db3ViewContract";
import { defineTable, makeColumnSet, prismaModel } from "../../db3core";
import { xPermission } from "../../schema/user";
import { kReadOnlyAuthMap } from "../common/entityCommon";
import { roleGrantsAuth, roleMetadataAuth, xBandRole } from "./bandRoleViews";

const metadataSelection = Prisma.validator<Prisma.GlobalRoleDefaultArgs>()({
    select: { publicId: true, name: true, description: true, color: true, sortOrder: true },
});
const associationAuth = {
    View: Permission.sysadmin, ViewOwn: Permission.sysadmin,
    Edit: Permission.never_grant, EditOwn: Permission.never_grant, Insert: Permission.never_grant,
};

export const xGlobalRole = defineTable({
    tableName: "GlobalRole", prismaModel: prismaModel<Prisma.GlobalRoleDelegate>(),
    getIdentity: (row: { publicId: GlobalRolePublicId }) => row.publicId,
    getSelectionArgs: () => metadataSelection, queryStrategy: "resolved", deletePolicy: "disabled",
    tableAuthMap: { View: Permission.manage_global_users, ViewOwn: Permission.manage_global_users,
        Edit: Permission.sysadmin, EditOwn: Permission.sysadmin, Insert: Permission.sysadmin },
    naturalOrderBy: [{ sortOrder: "asc" }, { name: "asc" }], queryParameters: {},
    getParameterizedWhereClause: (): Prisma.GlobalRoleWhereInput[] => [{ isDeleted: false }],
    getRowInfo: row => ({ pk: row.publicId, name: localizedText(row.name) ?? "", ownerUserId: null }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<GlobalRolePublicId>(),
        name: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "nameId", stringFormat: "PlainText", writeScope: "global", authMap: roleMetadataAuth }),
        description: columnName => new LocalizedStringField({ columnName, stringIdentityMember: "descriptionId", stringFormat: "Markdown", writeScope: "global", authMap: roleMetadataAuth }),
        sortOrder: () => MakeSortOrderField({ authMap: roleMetadataAuth }),
        color: () => MakeColorField({ authMap: roleMetadataAuth }),
        isDeleted: () => serverOwnedField(MakeIsDeletedField({ authMap: kReadOnlyAuthMap })),
        isRoleForNewUsers: columnName => serverOwnedField(new BoolField({ columnName, allowNull: false, defaultValue: false, authMap: kReadOnlyAuthMap })),
        isPublicRole: columnName => serverOwnedField(new BoolField({ columnName, allowNull: false, defaultValue: false, authMap: kReadOnlyAuthMap })),
        isSysAdminRole: columnName => serverOwnedField(new BoolField({ columnName, allowNull: false, defaultValue: false, authMap: kReadOnlyAuthMap })),
        permissions: tagsRef("GlobalRolePermission", "Permission", {
            associationLocalObjectMember: "globalRole", associationForeignObjectMember: "permission",
            getQuickFilterWhereClause: () => false, getCustomFilterWhereClause: () => false,
            authMap: roleGrantsAuth, validateWrite: context => validateRolePermissionWrite("global", context),
        }),
    }),
});

export const xGlobalRolePermission = defineTable({
    tableName: "GlobalRolePermission", prismaModel: prismaModel<Prisma.GlobalRolePermissionDelegate>(),
    getIdentity: (row: { publicId: GlobalRolePermissionPublicId }) => row.publicId,
    getSelectionArgs: () => ({ select: { publicId: true, permissionId: true, permission: { select: { publicId: true, name: true } } } }),
    tableAuthMap: associationAuth, deletePolicy: "disabled", naturalOrderBy: { publicId: "asc" },
    getRowInfo: row => ({ pk: row.publicId, name: row.permission?.name ?? "", ownerUserId: null }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }), publicId: () => MakePublicIdField<GlobalRolePermissionPublicId>(),
        globalRole: foreignRef(() => xGlobalRole, { fkidMember: "globalRoleId", authMap: kReadOnlyAuthMap }),
        permission: foreignRef(() => xPermission, { fkidMember: "permissionId", authMap: kReadOnlyAuthMap }),
    }),
});
export const xBandRolePermission = defineTable({
    tableName: "BandRolePermission", prismaModel: prismaModel<Prisma.BandRolePermissionDelegate>(),
    getIdentity: (row: { publicId: BandRolePermissionPublicId }) => row.publicId,
    getSelectionArgs: () => ({ select: { publicId: true, permissionId: true, permission: { select: { publicId: true, name: true } } } }),
    tableAuthMap: associationAuth, deletePolicy: "disabled", naturalOrderBy: { publicId: "asc" },
    getRowInfo: row => ({ pk: row.publicId, name: row.permission?.name ?? "", ownerUserId: null }),
    fields: makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }), publicId: () => MakePublicIdField<BandRolePermissionPublicId>(),
        bandRole: foreignRef(() => xBandRole, { fkidMember: "bandRoleId", authMap: kReadOnlyAuthMap }),
        permission: foreignRef(() => xPermission, { fkidMember: "permissionId", authMap: kReadOnlyAuthMap }),
    }),
});

const globalEditorSelection = Prisma.validator<Prisma.GlobalRoleDefaultArgs>()({ select: {
    ...metadataSelection.select, isRoleForNewUsers: true, isPublicRole: true, isSysAdminRole: true,
    permissions: { select: { publicId: true, permissionId: true, permission: { select: { publicId: true, name: true } } } },
} });
const bandEditorSelection = Prisma.validator<Prisma.BandRoleDefaultArgs>()({ select: {
    ...metadataSelection.select, isRoleForNewUsers: true, isPublicRole: true,
    bandRolePermissions: { select: { publicId: true, permissionId: true, permission: { select: { publicId: true, name: true } } } },
} });
const globalContract = deriveViewContract(xGlobalRole, globalEditorSelection);
const bandContract = deriveViewContract(xBandRole, bandEditorSelection);
export const globalRoleEditorView = defineCrudView({
    viewID: "GlobalRole_Editor", entity: xGlobalRole, operations: { create: true, update: true },
    selection: globalContract.prismaSelection, dtoSchema: globalContract.dtoSchema, hydrate: globalContract.hydrate,
    where: ({ auth }) => {
        auth.requirePermission(Permission.sysadmin);
        return {};
    },
});
export const bandRoleEditorView = defineCrudView({
    viewID: "BandRole_Editor", entity: xBandRole, operations: { create: true, update: true },
    selection: bandContract.prismaSelection, dtoSchema: bandContract.dtoSchema, hydrate: bandContract.hydrate,
    where: ({ auth }) => {
        auth.requirePermission(Permission.sysadmin);
        return {};
    },
});
const listContract = deriveViewContract(xGlobalRole, metadataSelection);
export const globalRoleListView = defineView({ viewID: "GlobalRole_List", entity: xGlobalRole,
    selection: listContract.prismaSelection, dtoSchema: listContract.dtoSchema, hydrate: listContract.hydrate });

declare module "../../db3core" {
    interface DB3TableTypeRegistry {
        GlobalRole: typeof xGlobalRole;
        GlobalRolePermission: typeof xGlobalRolePermission;
        BandRolePermission: typeof xBandRolePermission;
    }
}
