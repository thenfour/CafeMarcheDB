import { z } from "zod";
import { parsePublicId } from "shared/publicId";
import type { AuthorizationScopeSelection } from "src/auth/server/authorizationContext";

export const PresentationSelectionSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("platform") }).strict(),
    z.object({ kind: z.literal("configured-band") }).strict(),
    z.object({ kind: z.literal("band"), bandPublicId: z.string().regex(/^[A-Za-z0-9_-]{16}$/) }).strict(),
]);
export type PresentationSelection = z.infer<typeof PresentationSelectionSchema>;

export function selectionFromPresentationInput(selection: PresentationSelection): AuthorizationScopeSelection {
    return selection.kind === "band" ? {
        ...selection,
        bandPublicId: parsePublicId<"Band">(selection.bandPublicId),
    } : selection;
}

export const PresentationInputSchema = z.object({
    // `selection` i'm least comfortable with here... would be better to avoid the need for it.
    selection: PresentationSelectionSchema,
    routeLocale: z.string().max(128).nullish(),
    browserLanguages: z.array(z.string().max(128)).max(32).optional(),
    // cache key; not for identity or auth!
    // Q: why optional?
    clientRequestId: z.string().max(128).optional(),
}).strict();
export type PresentationInput = z.infer<typeof PresentationInputSchema>;
