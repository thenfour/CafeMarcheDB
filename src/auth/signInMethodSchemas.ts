import { z } from "zod";
import { UserEmailSchema } from "./schemas";

export const SignInMethodSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("email"), identifier: UserEmailSchema }).strict(),
    z.object({
        type: z.literal("google"),
        // OIDC subjects are case-sensitive ASCII strings; never normalize them.
        identifier: z.string().regex(/^[\x21-\x7e]{1,255}$/, "Enter the Google subject ID (sub), not an email address.").refine(value => !value.includes("@"), "Enter the Google subject ID, not an email address."),
    }).strict(),
]);

export type SignInMethodInput = z.infer<typeof SignInMethodSchema>;
