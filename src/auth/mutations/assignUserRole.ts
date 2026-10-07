import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { isPublicId, type RolePublicId } from "shared/publicId";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export const AssignUserRoleInput = z.object({
    userId: UserPublicIdSchema,
    roleId: z.custom<RolePublicId>(isPublicId).nullable(),
    acknowledgeContinuityRisk: z.boolean().default(false),
}).strict();

export default resolver.pipe(
    resolver.zod(AssignUserRoleInput),
    resolver.authorize(Permission.login),
    async () => requireRestoredApplicationFeature("accountRoles"),
);
