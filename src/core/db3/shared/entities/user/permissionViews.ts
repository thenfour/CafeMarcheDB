import { deriveViewContract } from "../../core/db3ViewContract";
import { defineCrudView } from "../../core/db3CrudView";
import { defineView } from "../../core/db3View";
import { PermissionForVisibilityArgs } from "../../schema/prismArgs";
import { xPermission } from "../../schema/user";

const permissionMetadataViewContract = deriveViewContract(
    xPermission,
    PermissionForVisibilityArgs,
);

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
    where: ({ authorization }) => ({
        isVisibility: { equals: true },
        id: { in: authorization.effectivePermissions.ids },
    }),
    dtoSchema: permissionMetadataViewContract.dtoSchema,
    hydrate: permissionMetadataViewContract.hydrate,
});
