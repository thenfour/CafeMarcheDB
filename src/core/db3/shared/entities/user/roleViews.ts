import { Prisma } from "db";
import { z } from "zod";
import { defineCreateUpdateView } from "../../core/db3CrudView";
import { roleEntity } from "./userEntities";

const RolePermissionEditorDtoSchema = z.object({
    id: z.number().int(),
    roleId: z.number().int().optional(),
    permissionId: z.number().int().optional(),
    permission: z.object({
        id: z.number().int(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
    }).nullable().optional(),
});

const RoleEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    color: z.string().nullable().optional(),
    significance: z.string().nullable().optional(),
    permissions: z.array(RolePermissionEditorDtoSchema).optional(),
});

const roleEditorSelection = Prisma.validator<Prisma.RoleDefaultArgs>()({
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

export const roleEditorView = defineCreateUpdateView({
    viewID: "Role_Editor",
    entity: roleEntity,
    selection: roleEditorSelection,
    dtoSchema: RoleEditorDtoSchema,
    hydrate: dto => dto,
});
