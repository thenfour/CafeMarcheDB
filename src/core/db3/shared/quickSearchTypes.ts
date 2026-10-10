import { isPublicId, parsePublicId } from "shared/publicId";
import { QuickSearchItemType } from "shared/quickFilter";
import { BandPublicIdSchema, PresentationInputSchema } from "src/locale/shared/presentationInput";
import { z } from "zod";

export const QuickSearchPermissionPolicySchema = z.enum(["requireAll", "omitUnavailable"]);
export type QuickSearchPermissionPolicy = z.infer<typeof QuickSearchPermissionPolicySchema>;

export const QuickSearchInputSchema = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    keyword: z.string().max(768),
    allowedItemTypes: z.array(z.nativeEnum(QuickSearchItemType)).min(1).max(5),
    permissionPolicy: QuickSearchPermissionPolicySchema,
}).strict();
export type QuickSearchInput = z.infer<typeof QuickSearchInputSchema>;

/** The reference shell searches content and catalogs; association callers may also search people. */
export const shellSearchItemTypes = [QuickSearchItemType.event, QuickSearchItemType.instrument,
QuickSearchItemType.song, QuickSearchItemType.wikiPage] as const;

const matchFields = {
    name: z.string(),
    absoluteUri: z.string(),
    matchStrength: z.number().finite().positive(),
    matchingField: z.string(),
};
const songMatchSchema = z.object({
    itemType: z.literal(QuickSearchItemType.song),
    id: z.string().refine(isPublicId).transform(value => parsePublicId<"Song">(value)),
    ...matchFields,
}).strict();
export const SongQuickSearchResultsSchema = z.array(songMatchSchema);
export const QuickSearchResultsSchema = z.array(z.discriminatedUnion("itemType", [
    songMatchSchema,
    z.object({
        itemType: z.literal(QuickSearchItemType.event),
        id: z.string().refine(isPublicId).transform(value => parsePublicId<"Event">(value)),
        ...matchFields
    }).strict(),
    z.object({
        itemType: z.literal(QuickSearchItemType.instrument),
        id: z.string().refine(isPublicId).transform(value => parsePublicId<"Instrument">(value)),
        ...matchFields
    }).strict(),
    z.object({
        itemType: z.literal(QuickSearchItemType.user),
        id: z.string().refine(isPublicId).transform(value => parsePublicId<"User">(value)),
        ...matchFields
    }).strict(),
    z.object({
        itemType: z.literal(QuickSearchItemType.wikiPage),
        id: z.string().refine(isPublicId).transform(value => parsePublicId<"WikiPage">(value)),
        ...matchFields,
        canonicalWikiSlug: z.string()
    }).strict(),
]));
