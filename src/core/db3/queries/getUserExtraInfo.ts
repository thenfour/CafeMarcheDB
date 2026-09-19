import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, AuthorizationError, NotFoundError } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { getRequestAuthorization } from "src/auth/server/requestAuthorization";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xUser } from "../db3";
import { createDB3Authorization } from "../shared/db3Authorization";

export interface UserExtraInfo {
    identity: "Google" | "Password";
}

export default resolver.pipe(
    resolver.zod(z.object({
        userId: z.number(),
    })),
    async (args, ctx: AuthenticatedCtx) => {
        const { user, effectivePermissions } = await getRequestAuthorization(ctx.session);
        const publicData = createDB3Authorization(user, effectivePermissions);
        const summaryAuthorization = xUser.authorizeAndSanitize({
            contextDesc: "getUserExtraInfo",
            publicData,
            rowMode: "view",
            model: { id: args.userId, signInMethodSummary: null },
            fallbackOwnerId: null,
        });
        if (!summaryAuthorization.rowIsAuthorized
            || !("signInMethodSummary" in summaryAuthorization.authorizedModel)) {
            throw new AuthorizationError();
        }
        const ret = await db.user.findFirst({
            select: {
                signInMethods: { where: { type: "google" }, select: { id: true }, take: 1 },
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
            identity: ret.signInMethods.length > 0 ? "Google" : "Password",
        } satisfies UserExtraInfo;
    }
);



