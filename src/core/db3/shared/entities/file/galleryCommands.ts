import { z } from "zod";
import { defineCommand } from "../../core/db3Command";
import { xFrontpageGalleryItem } from "../../schema/file";

const ReorderGalleryItemsSchema = z.object({
    movingItemId: xFrontpageGalleryItem.identitySchema,
    newPositionItemId: xFrontpageGalleryItem.identitySchema,
    scopeRowIds: z.array(xFrontpageGalleryItem.identitySchema).min(1),
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

export const reorderGalleryItemsCommand = defineCommand({
    commandID: "FrontpageGalleryItem_Reorder",
    entity: xFrontpageGalleryItem,
    dtoSchema: ReorderGalleryItemsSchema,
    resultSchema: z.object({}).strict(),
    serialize: (value: z.infer<typeof ReorderGalleryItemsSchema>) => value,
});
