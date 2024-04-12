// src/auth/mutations/impersonateUser.ts
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import * as z from "zod"

export const SetShowingAdminControlsInput = z.object({
    showAdminControls: z.boolean().optional(),
    toggle: z.boolean().optional(), // takes priority over other
})

export default resolver.pipe(
    resolver.zod(SetShowingAdminControlsInput),
    resolver.authorize(Permission.sysadmin),
    async (args, ctx) => {
        await ctx.session.$setPublicData({
            showAdminControls: args.toggle ? (!ctx.session.$publicData.showAdminControls) : args.showAdminControls,
        });
    }
)