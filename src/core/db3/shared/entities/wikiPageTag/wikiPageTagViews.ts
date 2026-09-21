import { z } from "zod";
import { defineLegacyCrudView } from "../../core/db3CrudView";
import { wikiPageTagEntity } from "./wikiPageTagEntities";

const WikiPageTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
});

export const wikiPageTagEditorView = defineLegacyCrudView({
    viewID: "WikiPageTag_Editor",
    entity: wikiPageTagEntity,
    operations: { create: true, update: true, delete: true },
    dtoSchema: WikiPageTagEditorDtoSchema,
    hydrate: dto => dto,
});
