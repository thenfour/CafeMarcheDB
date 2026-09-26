// src/auth/mutations/impersonateUser.ts
import { resolver } from "@/src/auth/server/cmResolver"
import db from "db"
import { Permission } from "shared/permissions"
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads"
import { createPublicDataFromDatabase } from "../server/effectivePermissions"
import * as z from "zod"
import { UserPublicIdSchema } from "../schemas"
import { registerImpersonationAudit } from "../server/impersonationAudit"
import { requireCanManageUser } from "../server/userManagementPolicy"
import { makeUserManagementActor, makeUserManagementTarget } from "../server/userManagementState"

export const ImpersonateUserInput = z.object({
    userId: UserPublicIdSchema,
})

export default resolver.pipe(
    resolver.zod(ImpersonateUserInput),
    resolver.cmauthorize(Permission.impersonate_user),
    async ({ userId }, ctx) => {
        const originalActorUserId = ctx.auth.requireUser().id;

        // Re-read the actor and effective grants so revocation takes effect
        // before this sensitive operation.
        const freshAuth = await ctx.auth.refresh(db)
        freshAuth.requirePermission(Permission.impersonate_user)
        const actor = freshAuth.requireUser()

        const user = await db.user.findFirst({
            ...UserWithRolesArgs,
            where: { publicId: userId },
        })
        if (!user) throw new Error("Could not find user id " + userId)

        requireCanManageUser({
            actor: makeUserManagementActor(actor, freshAuth.effectivePermissions),
            target: makeUserManagementTarget(user),
            action: "impersonate",
        })

        await registerImpersonationAudit({
            ctx,
            event: "start",
            originalActorUserId,
            targetUserId: user.id,
        })

        await ctx.session.$create(await createPublicDataFromDatabase(db, {
            user,
            impersonatingFromUserId: originalActorUserId,
        }));

        return { userId: user.publicId }
    }
)
