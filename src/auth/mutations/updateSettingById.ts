import { resolver } from "@blitzjs/rpc";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UpdateSettingByIdSchema } from "../schemas";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";

type InputType = z.infer<typeof UpdateSettingByIdSchema>;

export default resolver.pipe(
    resolver.zod(UpdateSettingByIdSchema),
    resolver.authorize(Permission.content_admin),
    async ({ id, ...data }: InputType, ctx) => {
        try {
            const oldValues = await db.setting.findFirst({ where: { id } });
            const obj = await db.setting.update({
                where: { id },
                data,
            });

            await RegisterChange({
                action: ChangeAction.update,
                //context: "updateSettingById",
                changeContext: CreateChangeContext("updateSettingByIdMutation"),
                table: "setting",
                pkid: id,
                oldValues,
                newValues: obj,
                ctx,
            });

            return obj;
        } catch (e) {
            console.error(`Exception while updateSettingById ${id}`);
            console.error(e);
            throw (e);
        }
    }
);
