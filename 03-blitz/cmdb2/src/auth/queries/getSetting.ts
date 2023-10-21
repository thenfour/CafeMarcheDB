import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db from "db";
import { GetSettingSchema } from "../schemas";
import { Permission } from "shared/permissions";


export default resolver.pipe(
    resolver.zod(GetSettingSchema),
    //resolver.authorize("getSetting", Permission.view_settings),
    async ({ name }, ctx) => {
        try {
            const item = await db.setting.findFirst({
                where: { name },
            });

            return item?.value || null;
        } catch (e) {
            console.error(`Exception while getting setting ${name || "<null>"}`);
            console.error(e);
            throw (e);
        }

    }
);
