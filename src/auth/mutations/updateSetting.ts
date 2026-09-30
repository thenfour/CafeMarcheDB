import { resolver } from "@blitzjs/rpc"
import { cmauthorize } from "@/src/auth/server/cmResolver";
import type { CMAuthCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { clearBrandCache } from "src/server/brand";
import { UpdateSettingSchema } from "../schemas";
import { writeSettingValue } from "../server/settingWrite";
import { settingEditorView } from "src/core/db3/shared/entities/setting/settingViews";

// Generic setting administration is a platform operation. Delegated feature
// settings use narrow, typed mutations such as updateSiteBrandingSettings.
export default resolver.pipe(
    resolver.zod(UpdateSettingSchema),
    cmauthorize(Permission.sysadmin),
    async (args, ctx: CMAuthCtx) => {
        const result = await db.$transaction(async tx => {
            const auth = await ctx.auth.refresh(tx);
            auth.requirePermission(Permission.sysadmin);
            return writeSettingValue({
                db: tx,
                auth,
                name: args.name,
                value: args.value,
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
        clearBrandCache();
        return result ? settingEditorView.parseDto(result) : null;
    },
);
