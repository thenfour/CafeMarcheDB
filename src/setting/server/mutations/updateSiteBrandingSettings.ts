import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { SiteBrandingSettingsSchema, siteBrandingSettingByField } from "shared/siteBranding";
import { clearBrandCache } from "src/server/brand";
import { writeSettings } from "../settings";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";

export default resolver.pipe(
    resolver.zod(SiteBrandingSettingsSchema.extend({
        bandPublicId: BandPublicIdSchema.nullish(),
    })),
    async ({ bandPublicId, ...settings }, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session, bandPublicId);
        await db.$transaction(async tx => {
            const freshAuth = await auth.refresh(tx);
            const commands = Object.entries(siteBrandingSettingByField).map(([field, key]) => {
                // Each mapped field is a key of the schema validated by this resolver.
                const value = settings[field as keyof typeof settings];
                return { hive: "band" as const, key, operation: { kind: "set" as const, value } };
            });
            await writeSettings(tx, freshAuth, commands, CreateChangeContext("updateSiteBrandingSettings"));
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
        clearBrandCache();
        return settings;
    },
);
