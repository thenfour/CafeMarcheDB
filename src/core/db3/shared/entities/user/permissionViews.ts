import { z } from "zod";
import { defineLegacyCrudView } from "../../core/db3CrudView";
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

export const permissionEditorView = defineLegacyCrudView({
    viewID: "Permission_Editor",
    entity: permissionEntity,
    operations: { create: true, update: true },
    dtoSchema: PermissionEditorDtoSchema,
    hydrate: dto => dto,
});
