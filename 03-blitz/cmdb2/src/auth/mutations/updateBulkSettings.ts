// bulk update settings by name

import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { SetSetting } from "shared/utils";
import { z } from "zod";
import { UpdateBulkSettingsSchema } from "../schemas";

type InputType = z.infer<typeof UpdateBulkSettingsSchema>;

export default resolver.pipe(
    resolver.zod(UpdateBulkSettingsSchema),
    resolver.authorize(Permission.sysadmin),
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
