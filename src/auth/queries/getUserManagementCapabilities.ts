import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { PresentationInputSchema } from "src/locale/shared/presentationInput";
import { UserPublicIdSchema } from "../schemas";
import { loadAuthorization } from "../server/serverAuthorization";
import { readUserManagementCapabilities } from "../server/userManagementCapabilitiesRead";

const GetUserManagementCapabilitiesInput = PresentationInputSchema.omit({ bandPublicId: true }).extend({
    userId: UserPublicIdSchema,
});

export default resolver.pipe(
    resolver.zod(GetUserManagementCapabilitiesInput),
    resolver.authorize(Permission.login),
    async ({ userId, ...locale }, ctx: Ctx) => readUserManagementCapabilities(db, await loadAuthorization(ctx.session, null), userId, locale),
);
