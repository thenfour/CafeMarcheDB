import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { UpdateSettingByIdSchema } from "../schemas"
import { z } from "zod"
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"
import { randomUUID } from "crypto";
import { AuthenticatedMiddlewareCtx } from "blitz";

type InputType = z.infer<typeof UpdateSettingByIdSchema>;

export default resolver.pipe(
    resolver.zod(UpdateSettingByIdSchema),
    resolver.authorize("updateSettingById", Permission.admin_auth),
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
