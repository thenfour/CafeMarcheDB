import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";

export interface UserExtraInfo {
    identity: "Google" | "Password";
}

export default resolver.pipe(
    resolver.authorize(Permission.basic_trust),
    resolver.zod(z.object({
        userId: z.number(),
    })),
    async (args, ctx: AuthenticatedCtx) => {
        const ret = await db.user.findUnique({
            select: {
                googleId: true,
            },
            where: {
                id: args.userId,
            },
        });

        if (!ret) throw new Error(`user not found`);

        return {
            identity: ret.googleId ? "Google" : "Password",
        } satisfies UserExtraInfo;
    }
);



