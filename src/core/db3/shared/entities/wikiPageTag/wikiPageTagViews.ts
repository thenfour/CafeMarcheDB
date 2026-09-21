import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { wikiPageTagEntity } from "./wikiPageTagEntities";

const WikiPageTagEditorDtoSchema = z.object({
    id: z.number().int(),
    text: z.string().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    significance: z.string().nullable().optional(),
});

const wikiPageTagEditorSelection = Prisma.validator<Prisma.WikiPageTagDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
    },
});

export const wikiPageTagEditorView = defineCrudView({
    viewID: "WikiPageTag_Editor",
    entity: wikiPageTagEntity,
    selection: wikiPageTagEditorSelection,
    dtoSchema: WikiPageTagEditorDtoSchema,
    hydrate: dto => dto,
});
