import { Prisma } from "db";
import { z } from "zod";
import { defineCreateUpdateView } from "../../core/db3CrudView";
import { permissionEntity } from "./userEntities";

const PermissionEditorDtoSchema = z.object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    isVisibility: z.boolean().optional(),
    significance: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
});

const permissionEditorSelection = Prisma.validator<Prisma.PermissionDefaultArgs>()({
    select: {
        id: true,
        name: true,
        description: true,
        sortOrder: true,
        isVisibility: true,
        significance: true,
        color: true,
        iconName: true,
    },
});

export const permissionEditorView = defineCreateUpdateView({
    viewID: "Permission_Editor",
    entity: permissionEntity,
    selection: permissionEditorSelection,
    dtoSchema: PermissionEditorDtoSchema,
    hydrate: dto => dto,
});
