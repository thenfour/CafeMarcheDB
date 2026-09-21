import { Prisma } from "db";
import { z } from "zod";
import { defineCrudView } from "../../core/db3CrudView";
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

const userTagEditorSelection = Prisma.validator<Prisma.UserTagDefaultArgs>()({
    select: {
        id: true,
        text: true,
        description: true,
        color: true,
        sortOrder: true,
        significance: true,
        cssClass: true,
    },
});

export const userTagEditorView = defineCrudView({
    viewID: "UserTag_Editor",
    entity: userTagEntity,
    operations: { create: true, update: true, delete: true },
    selection: userTagEditorSelection,
    dtoSchema: UserTagEditorDtoSchema,
    hydrate: dto => dto,
});
