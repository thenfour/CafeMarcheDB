import { resolver } from "@/src/auth/server/cmResolver";
import db from "db";
import { Permission } from "shared/permissions";
import {
    roleDashboardView,
} from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";

export default resolver.pipe(
    resolver.cmauthorize(Permission.sysadmin),
    async (_params: unknown, ctx) => {
        const auth = await ctx.auth.refresh(db);
        auth.requirePermission(Permission.sysadmin);
        const result = await queryView({
            view: roleDashboardView,
            filter: { items: [] },
            cmdbQueryContext: "getAllRoles",
            orderBy: undefined,
        }, auth);
        return result.items;
    },
);
