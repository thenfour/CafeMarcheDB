import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { CreateChangeContext } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { clearBrandCache } from "src/server/brand";
import { UpdateBulkSettingsSchema } from "../schemas";
import { requireActualSysadmin } from "../server/actualSysadmin";
import { writeSettingValue } from "../server/settingWrite";

export default resolver.pipe(
    resolver.zod(UpdateBulkSettingsSchema),
    resolver.authorize(Permission.sysadmin),
    async (items, ctx: AuthenticatedCtx) => {
        await db.$transaction(async tx => {
            await requireActualSysadmin(tx, ctx.session.userId);
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
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        clearBrandCache();
    },
);
