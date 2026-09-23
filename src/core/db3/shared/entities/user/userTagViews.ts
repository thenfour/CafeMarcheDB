import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { xUserTag } from "../../schema/user";

const UserTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
    cssClass: z.string().nullable().optional(),
});

export const userTagEditorView = defineCrudView({
    viewID: "UserTag_Editor",
    entity: xUserTag,
    operations: { create: true, update: true, delete: true },
    dtoSchema: UserTagEditorDtoSchema,
    hydrate: dto => xUserTag.getClientModel(dto, "view"),
});
