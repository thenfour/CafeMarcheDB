import { resolver } from "@blitzjs/rpc";
import db from "db";
import { CreateSettingSchema } from "../schemas";
import { Permission } from "shared/permissions";
import utils, { ChangeAction } from "shared/utils"

export default resolver.pipe(
    resolver.zod(CreateSettingSchema),
    resolver.authorize("createSetting", Permission.admin_settings),
    async (fields, ctx) => {
        try {
            const obj = await db.setting.create({
                data: fields,
            });

            await utils.RegisterChange({
                action: ChangeAction.insert,
                context: "insertSetting",
                table: "setting",
                pkid: obj.id,
                newValues: fields,
                ctx,
            });

            return obj;
        } catch (e) {
            console.error(`Exception while creating setting ${fields?.name}`);
            console.error(e);
            throw (e);
        }
    }
);
