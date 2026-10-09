import { z } from "zod";
import { isPublicId, parsePublicId } from "shared/publicId";
import { QuickSearchItemType } from "shared/quickFilter";
import { BandPublicIdSchema, PresentationInputSchema } from "src/locale/shared/presentationInput";

export const QuickSearchInputSchema = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    keyword: z.string().max(768),
    allowedItemTypes: z.array(z.nativeEnum(QuickSearchItemType)).min(1).max(5),
}).strict();
export type QuickSearchInput = z.infer<typeof QuickSearchInputSchema>;

export const SongQuickSearchResultsSchema = z.array(z.object({
    itemType: z.literal(QuickSearchItemType.song),
    id: z.string().refine(isPublicId).transform(value => parsePublicId<"Song">(value)),
    name: z.string(),
    absoluteUri: z.string(),
    matchStrength: z.number(),
    matchingField: z.string(),
}).strict());
