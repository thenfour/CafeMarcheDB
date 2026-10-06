import { z } from "zod";
import { isPublicId, parsePublicId } from "shared/publicId";

export const BandPublicIdSchema = z.string().refine(isPublicId, "Expected a band public ID")
    .transform(value => parsePublicId<"Band">(value));

export const PresentationInputSchema = z.object({
    bandPublicId: BandPublicIdSchema.nullish(),
    routeLocale: z.string().max(128).nullish(),
    browserLanguages: z.array(z.string().max(128)).max(32).optional(),
    // cache key; not for identity or auth!
    // Q: why optional?
    clientRequestId: z.string().max(128).optional(),
}).strict();
export type PresentationInput = z.infer<typeof PresentationInputSchema>;
