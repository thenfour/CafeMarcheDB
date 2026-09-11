// src/auth/mutations/impersonateUser.ts
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads"
import { createPublicDataFromDatabase } from "../server/effectivePermissions"
import * as z from "zod"
import { requireFreshPermission } from "../server/permissionAuthorization"
import { registerImpersonationAudit } from "../server/impersonationAudit"
import { requireCanManageUser } from "../server/userManagementPolicy"

export const ImpersonateUserInput = z.object({
    userId: z.number().int().positive(),
})

export default resolver.pipe(
    resolver.zod(ImpersonateUserInput),
    resolver.authorize(Permission.impersonate_user),
    async ({ userId }, ctx) => {
        const originalActorUserId = ctx.session.userId;

        // Re-read the actor and effective grants so revocation takes effect
        // before this sensitive operation.
        const actor = await requireFreshPermission(db, originalActorUserId, Permission.impersonate_user)

        const user = await db.user.findFirst({
            ...UserWithRolesArgs,
            where: { id: userId },
        })
        if (!user) throw new Error("Could not find user id " + userId)
        requireCanManageUser({
            actor: { ...actor, role: { permissions: actor.effectivePermissionNames.map(name => ({ permission: { name } })) } },
            target: user,
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

        return { userId: user.id }
    }
)
