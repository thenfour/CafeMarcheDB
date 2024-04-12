// src/auth/mutations/stopImpersonating.ts
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions";
import { CreatePublicData } from "types";

export default resolver.pipe(
    //resolver.authorize("impersonateUser", Permission.impersonate_user),
    async (_, ctx) => {
        const userId = ctx.session.$publicData.impersonatingFromUserId
        if (!userId) {
            throw new Error("Not impersonating anyone");
        }

        const user = await db.user.findFirst({
            where: { id: userId },
            include: { role: { include: { permissions: { include: { permission: true } } } } }
        })
        if (!user) throw new Error("Could not find user id " + userId)

        await ctx.session.$create(CreatePublicData({ user }));

        return user
    }
);


