import { Prisma } from "db";
import { defineCrudView } from "../../core/db3CrudView";
import { deriveViewContract } from "../../core/db3ViewContract";
import { xRole } from "../../schema/user";

const roleEditorArgs = Prisma.validator<Prisma.RoleDefaultArgs>()({
    select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        color: true,
        significance: true,
        permissions: {
            select: {
                id: true,
                roleId: true,
                permissionId: true,
                permission: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        sortOrder: true,
                    },
                },
            },
            orderBy: [
                { permission: { sortOrder: "asc" } },
                { permission: { name: "asc" } },
                { permission: { id: "asc" } },
            ],
        },
    },
});

const roleEditorViewContract = deriveViewContract(
    xRole,
    roleEditorArgs,
);

export const roleEditorView = defineCrudView({
    viewID: "Role_Editor",
    entity: xRole,
    operations: { create: true, update: true },
    selection: roleEditorViewContract.prismaSelection,
    dtoSchema: roleEditorViewContract.dtoSchema,
    hydrate: roleEditorViewContract.hydrate,
});
