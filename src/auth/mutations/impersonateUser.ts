import { authorizationDatabase } from "../server/authorizationContext";
// src/auth/mutations/impersonateUser.ts
import { cmauthorize } from "@/src/auth/server/cmResolver"
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import { NullableHydrateUserWithRoles, UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads"
import * as z from "zod"
import { UserPublicIdSchema } from "../schemas"
import { createPublicDataFromDatabase } from "../server/effectivePermissions"
import { registerImpersonationAudit } from "../server/impersonationAudit"
import { requireCanManageUser } from "../server/userManagementPolicy"
import { makeUserManagementActor, makeUserManagementTarget } from "../server/userManagementState"

export const ImpersonateUserInput = z.object({
    userId: UserPublicIdSchema,
})

export default resolver.pipe(
    resolver.zod(ImpersonateUserInput),
    cmauthorize(Permission.impersonate_user),
    async ({ userId }, ctx) => {
        const originalActorUserId = ctx.auth.requireUser().userId;

        // Re-read the actor and effective grants so revocation takes effect
        // before this sensitive operation.
        const freshAuth = await ctx.auth.refresh(authorizationDatabase)
        freshAuth.requirePermission(Permission.impersonate_user)
        const actor = freshAuth.requireUser()

        const user = NullableHydrateUserWithRoles(await db.user.findFirst({
            ...UserWithRolesArgs,
            where: { publicId: userId },
        }));
        if (!user) throw new Error("Could not find user id " + userId)

        requireCanManageUser({
            actor: makeUserManagementActor(actor.user, freshAuth),
            target: makeUserManagementTarget(user),
            action: "impersonate",
        })

        await registerImpersonationAudit({
            ctx,
            event: "start",
            originalActorUserId,
            targetUserId: user.id,
        })

        await ctx.session.$create(await createPublicDataFromDatabase(authorizationDatabase, {
            user,
            impersonatingFromUserId: originalActorUserId,
        }));

        return { userId: user.publicId }
    }
)
