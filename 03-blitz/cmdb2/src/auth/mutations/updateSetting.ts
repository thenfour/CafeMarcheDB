import { paginate } from "blitz";
import { resolver } from "@blitzjs/rpc"
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { UpdateSettingSchema } from "../schemas"
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils"

// set a setting by name.
// args is { name, value }


export default resolver.pipe(
    resolver.zod(UpdateSettingSchema),
    resolver.authorize("updateSetting", Permission.admin_settings),
    async (args, ctx) => {
        try {
            const oldValues = await db.setting.findFirst({ where: { name: args.name } });
            const shouldBeDeleted = (args.value === null || args.value === undefined || args.value === "");

            if (oldValues) { // exists.
                if (shouldBeDeleted) {
                    // delete existing.
                    await RegisterChange({
                        action: ChangeAction.delete,
                        changeContext: CreateChangeContext("updateSetting:Delete"),
                        table: "setting",
                        pkid: oldValues.id,
                        oldValues,
                        ctx,
                    });
                    return null;
                }

                // update existing.
                if (oldValues.value === args.value) {
                    // nop.
                    return oldValues;
                }
                const newValues = await db.setting.update({
                    where: { name: args.name },
                    data: {
                        value: args.value || "",//
                    }
                });
                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext: CreateChangeContext("updateSetting:Update"),
                    table: "setting",
                    pkid: oldValues.id,
                    oldValues,
                    newValues,
                    ctx,
                });
                return newValues;
            }

            if (shouldBeDeleted) {
                // nop.
                return null;
            }

            // insert.
            const newValues = await db.setting.create({
                data: {
                    name: args.name,//
                    value: args.value || "",//
                }
            });

            await RegisterChange({
                action: ChangeAction.insert,
                changeContext: CreateChangeContext("updateSetting:insert"),
                table: "setting",
                pkid: newValues.id,
                newValues,
                ctx,
            });

        } catch (e) {
            console.error(`Exception while creating/updating setting ${JSON.stringify(args)}`);
            console.error(e);
            throw (e);
        }
    }
);
