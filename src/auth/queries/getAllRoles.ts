import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import {
    createDb3RequestAuthorization,
    roleDashboardView,
} from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { requireFreshPermission } from "../server/permissionAuthorization";

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (_params: unknown, ctx) => {
        await requireFreshPermission(db, ctx.session.userId, Permission.sysadmin);
        const auth = await createDb3RequestAuthorization(ctx);
        const result = await queryView({
            view: roleDashboardView,
            filter: { items: [] },
            cmdbQueryContext: "getAllRoles",
            orderBy: undefined,
        }, auth);
        return result.items;
    },
);
