import { resolver } from "@/src/auth/server/cmResolver";
import type { CMCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { CreateChangeContext } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { clearBrandCache } from "src/server/brand";
import { UpdateSettingSchema } from "../schemas";
import { writeSettingValue } from "../server/settingWrite";

// Generic setting administration is a platform operation. Delegated feature
// settings use narrow, typed mutations such as updateSiteBrandingSettings.
export default resolver.pipe(
    resolver.zod(UpdateSettingSchema),
    resolver.cmauthorize(Permission.sysadmin),
    async (args, ctx: CMCtx) => {
        const result = await db.$transaction(async tx => {
            (await ctx.auth.refresh(tx)).requirePermission(Permission.sysadmin);
            return writeSettingValue({
                db: tx,
                ctx,
                changeContext: CreateChangeContext("updateSetting"),
                name: args.name,
                value: args.value,
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
        clearBrandCache();
        return result;
    },
);
