import { CreateChangeContext } from "@/src/auth/server/activityLog";
import { resolver } from "@blitzjs/rpc"
import { cmauthorize } from "@/src/auth/server/cmResolver";
import type { CMAuthCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { clearBrandCache } from "src/server/brand";
import { writeSettingValue } from "../settingWrite";
import { UpdateBulkSettingsSchema } from "@/src/setting/shared/settingsSchemas";

export default resolver.pipe(
    resolver.zod(UpdateBulkSettingsSchema),
    cmauthorize(Permission.sysadmin),
    async (items, ctx: CMAuthCtx) => {
        await db.$transaction(async tx => {
            const auth = await ctx.auth.refresh(tx);
            auth.requirePermission(Permission.sysadmin);
            const changeContext = CreateChangeContext("updateBulkSettings");
            for (const item of items) {
                await writeSettingValue({
                    db: tx,
                    auth,
                    changeContext,
                    name: item.name,
                    value: item.value,
                });
            }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
        clearBrandCache();
    },
);
