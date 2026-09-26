import { z } from "zod";
import { defineCommand } from "../../core/db3Command";
import { xMenuLink } from "../../schema/menuLink";

const ReorderMenuLinksSchema = z.object({
    movingItemId: xMenuLink.identitySchema,
    newPositionItemId: xMenuLink.identitySchema,
    scopeRowIds: z.array(xMenuLink.identitySchema).min(1).max(1000),
}).strict().superRefine((value, context) => {
    if (new Set(value.scopeRowIds).size !== value.scopeRowIds.length
        || !value.scopeRowIds.includes(value.movingItemId)
        || !value.scopeRowIds.includes(value.newPositionItemId)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Reorder requires unique scoped IDs containing both endpoints.",
        });
    }
});

export const reorderMenuLinksCommand = defineCommand({
    commandID: "MenuLink_Reorder",
    entity: xMenuLink,
    dtoSchema: ReorderMenuLinksSchema,
    resultSchema: z.object({}).strict(),
    serialize: (value: z.infer<typeof ReorderMenuLinksSchema>) => value,
});
