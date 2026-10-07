import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

const SearchUserMergeCandidatesInput = z.object({
    query: z.string().trim().max(150),
    excludeUserId: UserPublicIdSchema,
}).strict();

export default resolver.pipe(
    resolver.zod(SearchUserMergeCandidatesInput),
    resolver.authorize(Permission.login),
    async () => requireRestoredApplicationFeature("accountMerge"),
);
