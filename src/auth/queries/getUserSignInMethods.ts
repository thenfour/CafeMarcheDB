import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { createDb3RequestAuthorization, userSignInMethodAdminView } from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { z } from "zod";
import { requireSignInMethodTargetByPublicId } from "../server/signInMethods";
import { UserPublicIdSchema } from "../schemas";

export default resolver.pipe(
    resolver.zod(z.object({ userId: UserPublicIdSchema }).strict()),
    resolver.authorize(Permission.sysadmin),
    async ({ userId }, ctx) => {
        const auth = await createDb3RequestAuthorization(ctx);
        const result = await queryView({
            cmdbQueryContext: "getUserSignInMethods",
            view: userSignInMethodAdminView,
            filter: { tableParams: { userId } },
            orderBy: undefined,
        }, auth);
        // The view checks fresh admin authorization before any target lookup.
        const user = await requireSignInMethodTargetByPublicId(db, userId);
        return {
            methods: result.items,
            hasPassword: !!user.hashedPassword,
        };
    },
);
