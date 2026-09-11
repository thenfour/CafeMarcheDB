import { resolver } from "@blitzjs/rpc";
import type { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { CreateChangeContext } from "shared/activityLog";
import { Permission } from "shared/permissions";
import {
    siteBrandingSettingByField,
    SiteBrandingSettingsSchema,
    type SiteBrandingSettings,
} from "shared/siteBranding";
import { clearBrandCache } from "src/server/brand";
import { requireFreshPermission } from "../server/permissionAuthorization";
import { writeSettingValue } from "../server/settingWrite";

export default resolver.pipe(
    resolver.zod(SiteBrandingSettingsSchema),
    resolver.authorize(Permission.manage_site_branding),
    async (settings: SiteBrandingSettings, ctx: AuthenticatedCtx) => {
        const result = await db.$transaction(async tx => {
            await requireFreshPermission(tx, ctx.session.userId, Permission.manage_site_branding);
            const changeContext = CreateChangeContext("updateSiteBrandingSettings");
            const updatedEntries: Array<[string, string]> = [];
            for (const [field, settingName] of Object.entries(siteBrandingSettingByField)) {
                const value = settings[field as keyof SiteBrandingSettings];
                const row = await writeSettingValue({
                    db: tx,
                    ctx,
                    changeContext,
                    name: settingName,
                    value,
                });
                updatedEntries.push([field, row?.value ?? ""]);
            }
            return Object.fromEntries(updatedEntries) as SiteBrandingSettings;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        // Clear only after the transaction commits so the cache cannot be
        // repopulated from pre-commit values.
        clearBrandCache();
        return result;
    },
);
