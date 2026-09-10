// src/auth/mutations/impersonateUser.ts
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads"
import { CreatePublicData } from "types"
import * as z from "zod"
import { requireCanManageUser } from "../server/userManagementPolicy"

export const ImpersonateUserInput = z.object({
    userId: z.number(),
})

export default resolver.pipe(
    resolver.zod(ImpersonateUserInput),
    resolver.authorize(Permission.impersonate_user),
    async ({ userId }, ctx) => {
        // fresh db state = safer.
        const [actor, user] = await Promise.all([
            db.user.findFirst({
                ...UserWithRolesArgs,
                where: { id: ctx.session.userId },
            }),
            db.user.findFirst({
                ...UserWithRolesArgs,
                where: { id: userId },
            }),
        ])
        if (!user) throw new Error("Could not find user id " + userId)
        requireCanManageUser({ actor, target: user, action: "impersonate" })

        await ctx.session.$create(CreatePublicData({
            user,
            // don't clobber the original impersonatingFromUserId; it's your true user id.
            // repro:
            // - log in as user A who is admin
            // - impersonate user B (who is also an admin)
            // - impersonate user C
            // impersonatingFromUserId should point to A, not B.
            impersonatingFromUserId: ctx.session.impersonatingFromUserId || ctx.session.userId,
        }));

        return user
    }
)
