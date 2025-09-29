import db from "db";
import type { Ctx } from "@blitzjs/next";
import { ChangeAction, CreateChangeContext, RegisterChange } from "./activityLog";
import { Setting } from "./settingKeys";

export interface SetSettingArgs {
    ctx: Ctx,
    setting: Setting | string,
    value?: any,
};

export async function SetSetting(args: SetSettingArgs) {
    const settingName = args.setting as string;
    if (args.value === null || args.value === undefined) {
        const existing = await db.setting.findFirst({ where: { name: settingName, } });
        if (!existing) return;

        await db.setting.deleteMany({ where: { name: settingName, } });

        await RegisterChange({
            action: ChangeAction.delete,
            ctx: args.ctx,
            changeContext: CreateChangeContext("SetSetting"),
            table: "setting",
            pkid: existing.id,
            oldValues: existing,
        });

        return;
    }

    const obj = await db.setting.create({
        data: {
            name: settingName,
            value: JSON.stringify(args.value),
        }
    });

    await RegisterChange({
        action: ChangeAction.delete,
        ctx: args.ctx,
        changeContext: CreateChangeContext("SetSetting"),
        table: "setting",
        pkid: obj.id,
        newValues: obj,
    });
}
