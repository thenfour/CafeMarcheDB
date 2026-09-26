import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, AuthorizationError, NotFoundError } from "blitz";
import db, { $Enums } from "db";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/requestAuthorization";
import { z } from "zod";
import { xUser } from "../db3";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";

export interface UserExtraInfo {
    signinMethods: ($Enums.SignInMethodType)[];
}

export default resolver.pipe(
    resolver.zod(z.object({
        userId: xUser.identitySchema,
    }).strict()),
    async (args, ctx: AuthenticatedCtx) => {
        const publicData = await loadAuthorization(ctx.session);
        const ret = await db.user.findFirst({
            select: {
                id: true,
                signInMethods: {
                    select: { type: true, },
                },
            },
            where: await GetAuthorizedTableReadWhere({
                table: xUser,
                currentUser: publicData.user,
                where: { publicId: args.userId },
                includeDeleted: publicData.hasPermission(Permission.recover_users),
            }),
        });

        if (!ret) {
            throw new NotFoundError();
        }

        const summaryAuthorization = xUser.authorizeAndSanitize({
            contextDesc: "getUserExtraInfo",
            publicData,
            rowMode: "view",
            model: {
                id: ret.id,
                signInMethodSummary: null, // force inclusion of this field for authorization purposes
            },
            fallbackOwnerId: null,
        });
        if (!summaryAuthorization.rowIsAuthorized
            || !("signInMethodSummary" in summaryAuthorization.authorizedModel)) {
            throw new AuthorizationError();
        }

        return {
            signinMethods: ret.signInMethods.map(method => method.type),
        } satisfies UserExtraInfo;
    }
);
