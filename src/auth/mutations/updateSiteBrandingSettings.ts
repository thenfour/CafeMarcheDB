import { resolver } from "@blitzjs/rpc"
import { cmauthorize } from "@/src/auth/server/cmResolver";
import type { CMAuthCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { CreateChangeContext } from "@/src/auth/server/activityLog";
import { Permission } from "shared/permissions";
import {
    siteBrandingSettingByField,
    SiteBrandingSettingsSchema,
    type SiteBrandingSettings,
} from "shared/siteBranding";
import { clearBrandCache } from "src/server/brand";
import { writeSettingValue } from "../server/settingWrite";

export default resolver.pipe(
    resolver.zod(SiteBrandingSettingsSchema),
    cmauthorize(Permission.manage_site_branding),
    async (settings: SiteBrandingSettings, ctx: CMAuthCtx) => {
        const result = await db.$transaction(async tx => {
            const auth = await ctx.auth.refresh(tx);
            auth.requirePermission(Permission.manage_site_branding);
            const changeContext = CreateChangeContext("updateSiteBrandingSettings");
            const updatedEntries: Array<[string, string]> = [];
            for (const [field, settingName] of Object.entries(siteBrandingSettingByField)) {
                const value = settings[field as keyof SiteBrandingSettings];
                const row = await writeSettingValue({
                    db: tx,
                    auth,
                    changeContext,
                    name: settingName,
                    value,
                });
                updatedEntries.push([field, row?.value ?? ""]);
            }
            return Object.fromEntries(updatedEntries) as SiteBrandingSettings;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });

        // Clear only after the transaction commits so the cache cannot be
        // repopulated from pre-commit values.
        clearBrandCache();
        return result;
    },
);
