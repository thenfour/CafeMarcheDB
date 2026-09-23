import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { xPermission } from "../../schema/user";

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

export const permissionEditorView = defineCrudView({
    viewID: "Permission_Editor",
    entity: xPermission,
    operations: { create: true, update: true },
    dtoSchema: PermissionEditorDtoSchema,
    hydrate: dto => xPermission.getClientModel(dto, "view"),
});
