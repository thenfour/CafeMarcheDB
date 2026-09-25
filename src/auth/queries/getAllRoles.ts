import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import {
    roleDashboardView,
} from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { requireFreshPermission } from "../server/permissionAuthorization";
import { getRequestAuthorization } from "../server/requestAuthorization";

export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (_params: unknown, ctx) => {
        await requireFreshPermission(db, ctx.session.userId, Permission.sysadmin);
        const result = await queryView({
            view: roleDashboardView,
            filter: { items: [] },
            cmdbQueryContext: "getAllRoles",
            orderBy: undefined,
        }, await getRequestAuthorization(ctx.session));
        return result.items;
    },
);
