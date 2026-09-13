import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, NotFoundError } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { getRequestAuthorization } from "src/auth/server/requestAuthorization";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xUser } from "../db3";

export interface UserExtraInfo {
    identity: "Google" | "Password";
}

export default resolver.pipe(
    resolver.authorize(Permission.basic_trust),
    resolver.zod(z.object({
        userId: z.number(),
    })),
    async (args, ctx: AuthenticatedCtx) => {
        const { user, effectivePermissions } = await getRequestAuthorization(ctx.session);
        const ret = await db.user.findFirst({
            select: {
                googleId: true,
            },
            where: await GetAuthorizedTableReadWhere({
                table: xUser,
                currentUser: user,
                where: { id: args.userId },
                includeDeleted: effectivePermissions.includesName(Permission.recover_users),
            }),
        });

        if (!ret) throw new NotFoundError();

        return {
            identity: ret.googleId ? "Google" : "Password",
        } satisfies UserExtraInfo;
    }
);



