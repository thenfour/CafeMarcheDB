import { resolver } from "@blitzjs/rpc";
import { cmauthorize } from "@/src/auth/server/cmResolver";
import { Permission } from "shared/permissions";
import {
    roleDashboardView,
} from "src/core/db3/db3";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { platformScope } from "../server/authorizationContext";

export default resolver.pipe(
    cmauthorize({ permission: Permission.sysadmin, scope: platformScope }),
    async (_params: unknown, ctx) => {
        const auth = await ctx.auth.refresh();
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
