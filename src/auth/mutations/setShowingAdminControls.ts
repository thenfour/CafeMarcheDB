// src/auth/mutations/impersonateUser.ts
import { resolver } from "@blitzjs/rpc"
import db from "db"
import { Permission } from "shared/permissions"
import * as z from "zod"
import { requireActualSysadmin } from "../server/actualSysadmin"

export const SetShowingAdminControlsInput = z.object({
    showAdminControls: z.boolean().optional(),
    toggle: z.boolean().optional(), // takes priority over other
})

export default resolver.pipe(
    resolver.zod(SetShowingAdminControlsInput),
    resolver.authorize(Permission.sysadmin),
    async (args, ctx) => {
        await requireActualSysadmin(db, ctx.session.userId)
        await ctx.session.$setPublicData({
            showAdminControls: args.toggle ? (!ctx.session.$publicData.showAdminControls) : args.showAdminControls,
        });
    }
)
