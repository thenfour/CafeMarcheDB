import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";
// Register role association targets before compiling the matrix selections.
import "./roleViews";
import { deriveViewContract } from "../../core/db3ViewContract";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { PermissionForVisibilityArgs } from "../../schema/prismArgs";
import { xPermission } from "../../schema/user";

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

export const permissionVisibilityView = defineView({
    viewID: "Permission_Visibility",
    entity: xPermission,
    selection: permissionMetadataViewContract.prismaSelection,
    // Only show permissions that are marked as visible and that the user has effective access to.
    where: ({ auth }) => ({
        isVisibility: { equals: true },
        id: { in: auth.effectivePermissions.ids },
    }),
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
    where: ({ auth }) => {
        auth.requirePermission(Permission.sysadmin);
        return {};
    },
});
export const permissionBandRoleMatrixView = defineView({
    viewID: "Permission_BandRoleMatrix", entity: xPermission,
    selection: bandMatrixContract.prismaSelection,
    dtoSchema: bandMatrixContract.dtoSchema,
    hydrate: bandMatrixContract.hydrate,
    where: ({ auth }) => {
        auth.requirePermission(Permission.sysadmin);
        return {};
    },
});
