import { resolver } from "@/src/auth/server/cmResolver";
import type { CMCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { CreateChangeContext } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { clearBrandCache } from "src/server/brand";
import { UpdateBulkSettingsSchema } from "../schemas";
import { writeSettingValue } from "../server/settingWrite";

export default resolver.pipe(
    resolver.zod(UpdateBulkSettingsSchema),
    resolver.cmauthorize(Permission.sysadmin),
    async (items, ctx: CMCtx) => {
        await db.$transaction(async tx => {
            (await ctx.auth.refresh(tx)).requirePermission(Permission.sysadmin);
            const changeContext = CreateChangeContext("updateBulkSettings");
            for (const item of items) {
                await writeSettingValue({
                    db: tx,
                    ctx,
                    changeContext,
                    name: item.name,
                    value: item.value,
                });
            }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
        clearBrandCache();
    },
);
