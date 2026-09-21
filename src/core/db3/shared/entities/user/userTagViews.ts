import { z } from "zod";
import { defineLegacyCrudView } from "../../core/db3CrudView";
import { userTagEntity } from "./userEntities";

const UserTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    cssClass: z.string().nullable().optional(),
});

export const userTagEditorView = defineLegacyCrudView({
    viewID: "UserTag_Editor",
    entity: userTagEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: UserTagEditorDtoSchema,
    hydrate: dto => dto,
});
