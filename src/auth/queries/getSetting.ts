import { resolver } from "@blitzjs/rpc";
import db from "db";
import { GetSettingSchema } from "../schemas";


export default resolver.pipe(
    resolver.zod(GetSettingSchema),
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
