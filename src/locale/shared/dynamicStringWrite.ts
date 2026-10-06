import { z } from "zod";
import { isPublicId, parsePublicId } from "shared/publicId";

export const DynamicStringIdentitySchema = z.string()
    .refine(isPublicId, "Expected a string public ID")
    .transform(value => parsePublicId<"DynamicLocalizedString">(value));

/** Scope comes from the entity command; the client names its current owned identity and target locale. */
export const LocalizedFieldEditSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("set"),
        stringPublicId: DynamicStringIdentitySchema.nullable(),
        localeTag: z.string().min(1).max(128),
        value: z.string().max(1_000_000)
    }).strict(),
    z.object({
        kind: z.literal("inherit"),
        stringPublicId: DynamicStringIdentitySchema
    }).strict(),
]);
