// src/auth/mutations/stopImpersonating.ts
import { resolver } from "@blitzjs/rpc";
import db from "db";
import { UserWithRolesArgs } from "src/core/db3/shared/schema/userPayloads";
import { CreatePublicData } from "types";
import { registerImpersonationAudit } from "../server/impersonationAudit";

export default resolver.pipe(
    async (_, ctx) => {
        const originalActorUserId = ctx.session.$publicData.impersonatingFromUserId
        const targetUserId = ctx.session.userId;
        if (!originalActorUserId || !targetUserId) {
            throw new Error("Not impersonating anyone");
        }

        const user = await db.user.findFirst({
            ...UserWithRolesArgs,
            where: { id: originalActorUserId },
        })
        if (!user) throw new Error("Could not find user id " + originalActorUserId)

        await registerImpersonationAudit({
            ctx,
            event: "stop",
            originalActorUserId,
            targetUserId,
        })

        await ctx.session.$create(CreatePublicData({ user }));

        return { userId: user.id }
    }
);


