import { Prisma } from "db";
import { ZodToPrismaSelection } from "@/shared/prismaUtils";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
import { WikiPageTagAssignmentNaturalOrderBy } from "../../schema/prismArgs";
import { wikiPageEntity } from "./wikiEntities";

const WikiPageEditorTagDtoSchema = z.object({
    id: z.number().int(),
    text: z.string(),
    description: z.string(),
    color: z.string().nullable(),
    sortOrder: z.number().int(),
    significance: z.string().nullable(),
});

const WikiPageEditorTagAssociationDtoSchema = z.object({
    id: z.number().int(),
    tagId: z.number().int(),
    tag: WikiPageEditorTagDtoSchema,
});

const WikiPageEditorDtoSchema = z.object({
    id: z.number().int(),
    tags: z.array(WikiPageEditorTagAssociationDtoSchema),
});

const wikiPageEditorBaseSelection = ZodToPrismaSelection(WikiPageEditorDtoSchema);
const wikiPageEditorSelection = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    select: {
        ...wikiPageEditorBaseSelection.select,
        // Row authorization needs these values, but the strict DTO below
        // deliberately removes them from transport and from generated writes.
        createdByUserId: true,
        visiblePermissionId: true,
        tags: {
            ...wikiPageEditorBaseSelection.select.tags,
            orderBy: WikiPageTagAssignmentNaturalOrderBy,
        },
    },
});

export const wikiPageEditorView = defineCrudView({
    viewID: "WikiPage_Editor",
    entity: wikiPageEntity,
    operations: { update: true },
    selection: wikiPageEditorSelection,
    dtoSchema: WikiPageEditorDtoSchema,
    hydrate: dto => dto,
});
