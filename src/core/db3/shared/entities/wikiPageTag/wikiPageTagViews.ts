import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { xWikiPageTag } from "../../schema/wikiPageTag";

const WikiPageTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
});

export const wikiPageTagEditorView = defineCrudView({
    viewID: "WikiPageTag_Editor",
    entity: xWikiPageTag,
    operations: { create: true, update: true, delete: true },
    dtoSchema: WikiPageTagEditorDtoSchema,
    hydrate: dto => xWikiPageTag.getClientModel(dto, "view"),
});
