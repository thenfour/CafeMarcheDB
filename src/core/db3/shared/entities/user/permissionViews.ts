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


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/core/db3/shared/entities/user/permissionViews.ts:1-82
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 57810eaf31f0457102baf207cf1a49aa1dbbaf4ff7dde74d0fb9f4cf72de8cf7
// MIGRATION_REFERENCE_BEGIN
// import { Prisma } from "db";
// import { deriveViewContract } from "../../core/db3ViewContract";
// import { defineCrudView } from "../../core/db3CrudView";
// import { defineView } from "../../core/db3View";
// import { PermissionForVisibilityArgs } from "../../schema/prismArgs";
// import { xPermission } from "../../schema/user";
//
// const permissionMetadataViewContract = deriveViewContract(
//     xPermission,
//     PermissionForVisibilityArgs,
// );
//
// /** Display consumers use resolved Markdown; editors keep explicit translation state. */
// export const permissionDisplayContract = {
//     ...permissionMetadataViewContract,
//     hydrate: (...args: Parameters<typeof permissionMetadataViewContract.hydrate>) => {
//         const row = permissionMetadataViewContract.hydrate(...args);
//         return { ...row, description: row.description.value };
//     },
// };
//
// export const permissionEditorView = defineCrudView({
//     viewID: "Permission_Editor",
//     entity: xPermission,
//     operations: { create: true, update: true },
//     selection: permissionMetadataViewContract.prismaSelection,
//     dtoSchema: permissionMetadataViewContract.dtoSchema,
//     hydrate: permissionMetadataViewContract.hydrate,
// });
//
// export const permissionVisibilityView = defineView({
//     viewID: "Permission_Visibility",
//     entity: xPermission,
//     selection: permissionMetadataViewContract.prismaSelection,
//     // Only show permissions that are marked as visible and that the user has effective access to.
//     where: ({ auth }) => ({
//         isVisibility: { equals: true },
//         id: { in: auth.effectivePermissions.ids },
//     }),
//     dtoSchema: permissionMetadataViewContract.dtoSchema,
//     hydrate: permissionDisplayContract.hydrate,
// });
//
// const permissionRoleMatrixSelection = Prisma.validator<Prisma.PermissionDefaultArgs>()({
//     select: {
//         publicId: true,
//         name: true,
//         description: true,
//         sortOrder: true,
//         isVisibility: true,
//         color: true,
//         iconName: true,
//         roles: {
//             select: {
//                 publicId: true,
//                 roleId: true,
//                 role: {
//                     select: {
//                         publicId: true,
//                         name: true,
//                         description: true,
//                         sortOrder: true,
//                         color: true,
//                     },
//                 },
//             },
//         },
//     },
// });
//
// const permissionRoleMatrixContract = deriveViewContract(
//     xPermission,
//     permissionRoleMatrixSelection,
// );
//
// export const permissionRoleMatrixView = defineView({
//     viewID: "Permission_RoleMatrix",
//     entity: xPermission,
//     selection: permissionRoleMatrixContract.prismaSelection,
//     dtoSchema: permissionRoleMatrixContract.dtoSchema,
//     hydrate: permissionRoleMatrixContract.hydrate,
// });
// MIGRATION_REFERENCE_END
