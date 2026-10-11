import { UserPublicIdSchema } from "src/auth/schemas";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";

// Account dependency reports always span every band, independently of the page's selected band.
export const UserAccountAnalysisChoicesRequestSchema = PresentationInputSchema.omit({ bandPublicId: true });
export const UserMassAnalysisRequestSchema = UserAccountAnalysisChoicesRequestSchema.extend({
    userId: UserPublicIdSchema,
});
