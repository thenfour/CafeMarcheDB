// src/auth/mutations/impersonateUser.ts
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import { CreatePublicData } from "types"
import * as z from "zod"

export const ImpersonateUserInput = z.object({
    userId: z.number(),
})

export default resolver.pipe(
    resolver.zod(ImpersonateUserInput),
    resolver.authorize("impersonateUser", Permission.impersonate_user),
    async ({ userId }, ctx) => {
        const user = await db.user.findFirst({
            where: { id: userId },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
        })
        if (!user) throw new Error("Could not find user id " + userId)
        if (userId === ctx.session.$publicData.userId) {
            // nothing to do. maybe trying to impersonate as yourself?
            // get out.
            return user;
        }

        await ctx.session.$create(CreatePublicData(user,
            // don't clobber the original impersonatingFromUserId; it's your true user id.
            // repro:
            // - log in as user A who is admin
            // - impersonate user B (who is also an admin)
            // - impersonate user C
            // impersonatingFromUserId should point to A, not B.
            ctx.session.impersonatingFromUserId || ctx.session.userId
        ));

        return user
    }
)