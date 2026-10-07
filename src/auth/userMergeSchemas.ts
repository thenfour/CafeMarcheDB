import { z } from "zod";
import { UserPublicIdSchema } from "./schemas";

export const UserMergeInput = z.object({
    mainUserId: UserPublicIdSchema,
    retiringUserId: UserPublicIdSchema,
}).strict().refine(input => input.mainUserId !== input.retiringUserId, "Choose two different accounts.");

export const CommitUserMergeInput = z.object({
    participants: UserMergeInput,
    confirmation: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
