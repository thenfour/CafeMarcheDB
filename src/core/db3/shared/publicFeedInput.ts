import { z } from "zod";
import { BandPublicIdSchema, PresentationInputSchema } from "src/locale/shared/presentationInput";

export const PublicFeedInputSchema = PresentationInputSchema.pick({
    routeLocale: true,
    browserLanguages: true
})
    .extend({ bandPublicId: BandPublicIdSchema }).strict();

export type PublicFeedInput = z.infer<typeof PublicFeedInputSchema>;
