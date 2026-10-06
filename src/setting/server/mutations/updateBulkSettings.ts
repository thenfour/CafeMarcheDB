import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { BandPublicIdSchema } from "src/locale/shared/presentationInput";
import { clearBrandCache } from "src/server/brand";
import { SettingCommandSchema } from "../../shared/settingsContract";
import { writeSettings } from "../settings";
import { z } from "zod";

export default resolver.pipe(
    resolver.zod(z.object({
        commands: z.array(SettingCommandSchema),
        bandPublicId: BandPublicIdSchema.nullish(),
    }).strict()),
    async (input, ctx: Ctx) => {
        const auth = await loadAuthorization(ctx.session, input.bandPublicId);
        await db.$transaction(async tx => {
            await writeSettings(tx, await auth.refresh(tx), input.commands, CreateChangeContext("updateBulkSettings"));
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
        clearBrandCache();
    },
);
