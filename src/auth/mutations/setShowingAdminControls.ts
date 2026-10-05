// src/auth/mutations/impersonateUser.ts
import { cmauthorize } from "@/src/auth/server/cmResolver"
import { resolver } from "@blitzjs/rpc"
import { Permission } from "shared/permissions"
import * as z from "zod"
import { platformScope } from "../server/authorizationContext"

export const SetShowingAdminControlsInput = z.object({
    showAdminControls: z.boolean().optional(),
    toggle: z.boolean().optional(), // takes priority over other
})

export default resolver.pipe(
    resolver.zod(SetShowingAdminControlsInput),
    cmauthorize({ permission: Permission.sysadmin, scope: platformScope }),
    async (args, ctx) => {
        (await ctx.auth.refresh()).requirePermission(Permission.sysadmin);
        await ctx.session.$setPublicData({
            showAdminControls: args.toggle ? (!ctx.session.$publicData.showAdminControls) : args.showAdminControls,
        });
    }
)
