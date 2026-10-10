import { z } from "zod";
import { PresentationInputSchema, BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { xUserMinimum } from "../../schema/user";

export const MemberSongCreditsInputSchema = PresentationInputSchema.extend({
    bandPublicId: BandPublicIdSchema,
    userId: xUserMinimum.identitySchema,
    take: z.number().int().min(1).max(1000),
}).strict();

export type MemberSongCreditsInput = z.infer<typeof MemberSongCreditsInputSchema>;
