import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { userSignInMethodAdminView } from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { cmauthorize } from "../server/cmResolver";
import { requireSignInMethodTargetByPublicId } from "../server/signInMethods";

export default resolver.pipe(
    resolver.zod(z.object({ userId: UserPublicIdSchema }).strict()),
    cmauthorize(Permission.sysadmin),
    async ({ userId }, ctx) => {
        //const auth = await loadAuthorization(ctx.session);
        const result = await queryView(
            {
                cmdbQueryContext: "getUserSignInMethods",
                view: userSignInMethodAdminView,
                filter: { tableParams: { userId } },
                orderBy: undefined,
            },
            ctx.auth);
        // The view checks fresh admin authorization before any target lookup.
        const user = await requireSignInMethodTargetByPublicId(db, userId);
        return {
            methods: result.items,
            hasPassword: !!user.hashedPassword,
        };
    },
);
