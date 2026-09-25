import { resolver } from "@blitzjs/rpc";
import db from "db";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { requireSignInMethodTarget } from "../server/signInMethods";
import { getRequestAuthorization } from "../server/requestAuthorization";
import { DB3ReferenceStore, userSignInMethodAdminView } from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";

export default resolver.pipe(
    resolver.zod(z.object({ userId: z.number().int().positive() }).strict()),
    resolver.authorize(Permission.sysadmin),
    async ({ userId }, ctx) => {
        const result = await queryView({
            cmdbQueryContext: "getUserSignInMethods",
            view: userSignInMethodAdminView,
            filter: { tableParams: { userId } },
            orderBy: undefined,
        }, await getRequestAuthorization(ctx.session), new DB3ReferenceStore());
        // The view checks fresh admin authorization before any target lookup.
        const user = await requireSignInMethodTarget(db, userId);
        return {
            methods: result.items,
            hasPassword: !!user.hashedPassword,
        };
    },
);
