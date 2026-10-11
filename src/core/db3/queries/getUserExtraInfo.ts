import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx, NotFoundError } from "blitz";
import { $Enums } from "db";
import { Permission } from "shared/permissions";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { z } from "zod";
import { xUser } from "../db3";
import { userIdentitySummaryView } from "../shared/entities/user/userViews";
import { queryView } from "../server/db3QueryCore";

export interface UserExtraInfo {
    signinMethods: {
        type: $Enums.SignInMethodType;
        displayId: string | null
    }[];
}

export default resolver.pipe(
    resolver.zod(z.object({
        userId: xUser.identitySchema,
    }).strict()),
    async (args, ctx: AuthenticatedCtx) => {
        const auth = await loadAuthorization(ctx.session);
        auth.requirePermission(Permission.sysadmin);

        const result = await queryView({
            cmdbQueryContext: "getUserExtraInfo",
            view: userIdentitySummaryView,
            filter: { publicIds: [args.userId] },
            orderBy: undefined,
            take: 1,
            includeDeleted: auth.hasPermission(Permission.manage_global_users),
        }, auth);
        const user = result.items[0];
        if (!user) throw new NotFoundError();
        if (!user.signInMethods) {
            throw new Error("Sysadmin identity summary is missing sign-in methods.");
        }

        return {
            signinMethods: user.signInMethods.map(method => ({
                // The view validates this enum, but its DTO type widens it to string.
                type: method.type as $Enums.SignInMethodType,
                displayId: method.displayId,
            })),
        } satisfies UserExtraInfo;
    }
);
