// bulk update settings by name

import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { UpdateBulkSettingsSchema } from "../schemas"
import { z } from "zod"
import { Permission } from "shared/permissions";
import { ChangeAction, SetSetting } from "shared/utils"
import { randomUUID } from "crypto";
import { AuthenticatedMiddlewareCtx } from "blitz";

type InputType = z.infer<typeof UpdateBulkSettingsSchema>;

export default resolver.pipe(
    resolver.zod(UpdateBulkSettingsSchema),
    resolver.authorize("bulkUpdateSettings", Permission.admin_auth),
    async (items: InputType, ctx) => {
        try {
            for (let i = 0; i < items.length; ++i) {
                const item = items[i];
                try {
                    await SetSetting({ ctx, setting: item!.name, value: item!.value });
                } catch (e) {
                    console.error(`Exception while updating setting '${item?.name}'`);
                    console.error(e);
                }
            }
        } catch (e) {
            console.error(`Exception while bulkUpdateSettings`);
            console.error(e);
            throw (e);
        }
    }
);
