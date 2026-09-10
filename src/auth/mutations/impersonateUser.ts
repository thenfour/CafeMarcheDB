// src/auth/mutations/impersonateUser.ts
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads"
import { CreatePublicData } from "types"
import * as z from "zod"
import { requireActualSysadmin } from "../server/actualSysadmin"
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

        // The permission remains useful as the endpoint-level capability, but
        // the current operation additionally requires a fresh persisted
        // User.isSysAdmin check. A role-carried grant is not sufficient.
        await requireActualSysadmin(db, originalActorUserId)

        const user = await db.user.findFirst({
            ...UserWithRolesArgs,
            where: { id: userId },
        })
        if (!user) throw new Error("Could not find user id " + userId)
        requireCanManageUser({
            actor: { id: originalActorUserId, isSysAdmin: true },
            target: user,
            action: "impersonate",
        })

        await registerImpersonationAudit({
            ctx,
            event: "start",
            originalActorUserId,
            targetUserId: user.id,
        })

        await ctx.session.$create(CreatePublicData({
            user,
            impersonatingFromUserId: originalActorUserId,
        }));

        return { userId: user.id }
    }
)
