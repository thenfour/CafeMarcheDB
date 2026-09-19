import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, AuthorizationError, NotFoundError } from "blitz";
import db, { $Enums } from "db";
import { Permission } from "shared/permissions";
import { getRequestAuthorization } from "src/auth/server/requestAuthorization";
import { z } from "zod";
import { xUser } from "../db3";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { createDB3Authorization } from "../shared/db3Authorization";

export interface UserExtraInfo {
    signinMethods: ($Enums.SignInMethodType)[];
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
            model: {
                id: args.userId,
                signInMethodSummary: null, // force inclusion of this field for authorization purposes
            },
            fallbackOwnerId: null,
        });
        if (!summaryAuthorization.rowIsAuthorized
            || !("signInMethodSummary" in summaryAuthorization.authorizedModel)) {
            throw new AuthorizationError();
        }

        const ret = await db.user.findFirst({
            select: {
                signInMethods: {
                    select: { type: true, },
                },
            },
            where: await GetAuthorizedTableReadWhere({
                table: xUser,
                currentUser: user,
                where: { id: args.userId },
                includeDeleted: effectivePermissions.includesName(Permission.recover_users),
            }),
        });

        if (!ret) {
            throw new NotFoundError();
        }

        return {
            signinMethods: ret.signInMethods.map(method => method.type),
        } satisfies UserExtraInfo;
    }
);



