import { Prisma } from "@prisma/client";
import { gPermissionRegistry, Permission, type PermissionScope } from "shared/permissions";
import type { IAuthorization } from "src/auth/shared/cmAuthorization";
// Register role association targets before compiling the matrix selections.
import "./roleViews";
import { deriveViewContract } from "../../core/db3ViewContract";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { PermissionForVisibilityArgs } from "../../schema/prismArgs";
import { xPermission } from "../../schema/user";
import { selectableBandVisibilityPermissionWhere } from "./visibilityPermissionPolicy";

const permissionMetadataViewContract = deriveViewContract(
    xPermission,
    PermissionForVisibilityArgs,
);

/** Display consumers use resolved Markdown; editors keep explicit translation state. */
export const permissionDisplayContract = {
    ...permissionMetadataViewContract,
    hydrate: (...args: Parameters<typeof permissionMetadataViewContract.hydrate>) => {
        const row = permissionMetadataViewContract.hydrate(...args);
        return { ...row, description: row.description.value };
    },
};

export const permissionEditorView = defineCrudView({
    viewID: "Permission_Editor",
    entity: xPermission,
    operations: { create: true, update: true },
    selection: permissionMetadataViewContract.prismaSelection,
    dtoSchema: permissionMetadataViewContract.dtoSchema,
    hydrate: permissionMetadataViewContract.hydrate,
});

function roleGrantPermissionWhere(scope: PermissionScope, auth: IAuthorization): Prisma.PermissionWhereInput {
    auth.requirePermission(Permission.sysadmin);
    return {
        isDeleted: false,
        name: { in: gPermissionRegistry.filter(definition => definition.scope === scope && definition.key !== Permission.never_grant)
            .map(definition => definition.key) },
    };
}

export const permissionGlobalRoleChoicesView = defineView({
    viewID: "Permission_GlobalRoleChoices",
    entity: xPermission,
    selection: permissionMetadataViewContract.prismaSelection,
    dtoSchema: permissionMetadataViewContract.dtoSchema,
    hydrate: permissionMetadataViewContract.hydrate,
    where: ({ auth }) => roleGrantPermissionWhere("global", auth),
});

export const permissionBandRoleChoicesView = defineView({
    viewID: "Permission_BandRoleChoices",
    entity: xPermission,
    selection: permissionMetadataViewContract.prismaSelection,
    dtoSchema: permissionMetadataViewContract.dtoSchema,
    hydrate: permissionMetadataViewContract.hydrate,
    where: ({ auth }) => roleGrantPermissionWhere("band", auth),
});

export const permissionVisibilityView = defineView({
    viewID: "Permission_Visibility",
    entity: xPermission,
    selection: permissionMetadataViewContract.prismaSelection,
    where: ({ auth }) => selectableBandVisibilityPermissionWhere(auth),
    dtoSchema: permissionMetadataViewContract.dtoSchema,
    hydrate: permissionDisplayContract.hydrate,
});

const matrixMetadata = {
    publicId: true,
    name: true,
    description: true,
    sortOrder: true,
    isVisibility: true,
    color: true,
    iconName: true
} as const;

const globalMatrixContract = deriveViewContract(xPermission, Prisma.validator<Prisma.PermissionDefaultArgs>()({
    select: {
        ...matrixMetadata,
        globalRoles: {
            select: {
                publicId: true,
                globalRoleId: true,
                globalRole: {
                    select: {
                        publicId: true,
                        name: true,
                        description: true,
                        color: true,
                        sortOrder: true
                    }
                }
            }
        },
    }
}));
const bandMatrixContract = deriveViewContract(xPermission, Prisma.validator<Prisma.PermissionDefaultArgs>()({
    select: {
        ...matrixMetadata, bandRolePermissions: {
            select: {
                publicId: true,
                bandRoleId: true,
                bandRole: {
                    select: {
                        publicId: true,
                        name: true,
                        description: true,
                        color: true,
                        sortOrder: true
                    }
                }
            }
        },
    }
}));
export const permissionGlobalRoleMatrixView = defineView({
    viewID: "Permission_GlobalRoleMatrix",
    entity: xPermission,
    selection: globalMatrixContract.prismaSelection,
    dtoSchema: globalMatrixContract.dtoSchema,
    hydrate: globalMatrixContract.hydrate,
    where: ({ auth }) => roleGrantPermissionWhere("global", auth),
});
export const permissionBandRoleMatrixView = defineView({
    viewID: "Permission_BandRoleMatrix", entity: xPermission,
    selection: bandMatrixContract.prismaSelection,
    dtoSchema: bandMatrixContract.dtoSchema,
    hydrate: bandMatrixContract.hydrate,
    where: ({ auth }) => roleGrantPermissionWhere("band", auth),
});
