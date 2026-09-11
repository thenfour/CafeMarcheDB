import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import db from "db";
import { CreateChangeContext } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { clearBrandCache } from "src/server/brand";
import { UpdateSettingSchema } from "../schemas";
import { requireActualSysadmin } from "../server/actualSysadmin";
import { writeSettingValue } from "../server/settingWrite";

// Generic setting administration is a platform operation. Delegated feature
// settings use narrow, typed mutations such as updateSiteBrandingSettings.
export default resolver.pipe(
    resolver.zod(UpdateSettingSchema),
    resolver.authorize(Permission.sysadmin),
    async (args, ctx: AuthenticatedCtx) => {
        const result = await db.$transaction(async tx => {
            await requireActualSysadmin(tx, ctx.session.userId);
            return writeSettingValue({
                db: tx,
                ctx,
                changeContext: CreateChangeContext("updateSetting"),
                name: args.name,
                value: args.value,
            });
        });
        clearBrandCache();
        return result;
    },
);
